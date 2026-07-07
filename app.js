// Elements
const connectBtn = document.getElementById('connectBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const orb = document.getElementById('orb');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const transcriptEl = document.getElementById('transcript');
const toolsLogEl = document.getElementById('toolsLog');
const userIdInput = document.getElementById('userIdInput');

// State
let peerConnection = null;
let dataChannel = null;
let mediaStream = null;

let pendingToolCalls = {}; 
let expectedToolCallIds = new Set();
let completedToolCallIds = new Set();
let responseDoneReceived = false;

// UI Handlers
function setStatus(state) {
    orb.className = 'orb';
    statusDot.className = 'status-dot';
    
    if (state === 'connected') {
        orb.classList.add('orb-connected');
        statusDot.classList.add('connected');
        statusText.textContent = 'Listening...';
        connectBtn.classList.add('hidden');
        disconnectBtn.classList.remove('hidden');
    } else if (state === 'speaking') {
        orb.classList.add('orb-speaking');
        statusDot.classList.add('connected');
        statusText.textContent = 'Speaking...';
    } else if (state === 'disconnected') {
        orb.classList.add('orb-disconnected');
        statusText.textContent = 'Disconnected';
        connectBtn.classList.remove('hidden');
        disconnectBtn.classList.add('hidden');
    } else if (state === 'error') {
        orb.classList.add('orb-disconnected');
        statusDot.classList.add('error');
        statusText.textContent = 'Error';
    }
}

function appendTranscript(role, text) {
    if (!text) return;
    const div = document.createElement('div');
    div.className = `message msg-${role}`;
    div.textContent = text;
    transcriptEl.appendChild(div);
    transcriptEl.scrollTop = transcriptEl.scrollHeight;
}

function appendToolLog(name, args, status = '') {
    const div = document.createElement('div');
    div.className = `tool-log ${status}`;
    let argsText = typeof args === 'object' ? JSON.stringify(args) : args;
    div.innerHTML = `<span class="tool-name">ƒ ${name}</span>${argsText}`;
    toolsLogEl.appendChild(div);
    toolsLogEl.scrollTop = toolsLogEl.scrollHeight;
}

// Connection Setup
async function initWebRTC() {
    try {
        const userId = userIdInput.value.trim() || 'default-user';
        
        // 1. Get ephemeral token from backend
        const tokenResponse = await fetch('/api/voice/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId })
        });
        
        if (!tokenResponse.ok) {
            throw new Error(`Failed to get session token: ${await tokenResponse.text()}`);
        }
        
        const data = await tokenResponse.json();
        const ephemeralKey = data.value || (data.client_secret && data.client_secret.value);

        // 2. Setup WebRTC Peer Connection
        peerConnection = new RTCPeerConnection();
        
        // Setup audio element for playback
        const audioEl = document.createElement('audio');
        audioEl.autoplay = true;
        peerConnection.ontrack = e => {
            audioEl.srcObject = e.streams[0];
            setStatus('speaking'); // Model starts outputting audio
        };

        // 3. Setup Data Channel
        dataChannel = peerConnection.createDataChannel('oai-events');
        dataChannel.addEventListener('message', handleDataChannelMessage);
        
        // Trigger agent to greet the user automatically once connected
        dataChannel.addEventListener('open', () => {
            sendEvent({
                type: 'response.create',
                response: {
                    instructions: "Please greet the user warmly by name (if available in your context), introduce yourself as their Generac Solar Advisor, and ask how you can help them with their solar proposal today."
                }
            });
        });

        // 4. Capture Microphone
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStream.getTracks().forEach(track => peerConnection.addTrack(track, mediaStream));

        // 5. Connect to OpenAI
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        const baseUrl = "https://api.openai.com/v1/realtime/calls";
        
        const sdpResponse = await fetch(baseUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ephemeralKey}`,
                'Content-Type': 'application/sdp'
            },
            body: offer.sdp
        });

        if (!sdpResponse.ok) {
            throw new Error(`SDP Exchange failed: ${await sdpResponse.text()}`);
        }

        const answerSdp = await sdpResponse.text();
        await peerConnection.setRemoteDescription({ type: 'answer', sdp: answerSdp });
        
        resetVisualDeck();
        setStatus('connected');
        
    } catch (err) {
        console.error("WebRTC Error:", err);
        setStatus('error');
        disconnect();
    }
}

// Data Channel Event Handling
async function handleDataChannelMessage(e) {
    const event = JSON.parse(e.data);
    const type = event.type;

    if (type === 'response.audio.done' || type === 'response.output_audio.done') {
        setStatus('connected'); // Back to listening
    }
    
    if (type === 'conversation.item.input_audio_transcription.completed') {
        appendTranscript('user', event.transcript);
    }
    
    if (type === 'response.audio_transcript.done' || type === 'response.output_audio_transcript.done' || type === 'response.output_text.done') {
        appendTranscript('assistant', event.transcript || event.text);
    }

    // Function Calling
    if (type === 'response.function_call_arguments.delta') {
        const callId = event.call_id;
        if (!pendingToolCalls[callId]) {
            pendingToolCalls[callId] = { name: event.name, args: '' };
        }
        pendingToolCalls[callId].args += event.delta;
    }

    if (type === 'response.function_call_arguments.done') {
        const callId = event.call_id;
        const call = pendingToolCalls[callId];
        if (call) {
            delete pendingToolCalls[callId];
            dispatchTool(callId, event.name || call.name, event.arguments || call.args);
        }
    }
    
    // Coordination
    if (type === 'response.created') {
        expectedToolCallIds.clear();
        completedToolCallIds.clear();
        responseDoneReceived = false;
    }
    
    if (type === 'response.done') {
        responseDoneReceived = true;
        const outputItems = event.response?.output || [];
        
        for (const item of outputItems) {
            if (item.type === 'function_call') {
                if (!completedToolCallIds.has(item.call_id)) {
                    expectedToolCallIds.add(item.call_id);
                }
            }
        }
        
        checkAndTriggerResponse();
    }
}

async function dispatchTool(callId, name, argsStr) {
    let args = {};
    try {
        args = argsStr ? JSON.parse(argsStr) : {};
    } catch (e) {
        console.warn("Invalid JSON in tool args", argsStr);
    }
    
    appendToolLog(name, args);
    let output = '';
    const userId = userIdInput.value.trim() || 'default-user';

    try {
        if (name === 'search_docs') {
            const res = await fetch('/api/voice/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: args.query || '' })
            });
            const data = await res.json();
            output = data.context;
            appendToolLog(name, 'Success', 'success');
        } 
        else if (name === 'recall_user_memory') {
            const res = await fetch('/api/voice/memory/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: args.query || '', user_id: userId })
            });
            const data = await res.json();
            output = data.memories;
            appendToolLog(name, 'Success', 'success');
        }
        else if (name === 'save_user_memory') {
            const res = await fetch('/api/voice/memory/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fact: args.fact || '', user_id: userId })
            });
            output = 'Memory saved.';
            appendToolLog(name, 'Success', 'success');
        }
        else if (name === 'get_design_data') {
            const res = await fetch('/api/voice/design_data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId })
            });
            const data = await res.json();
            output = typeof data.data === 'string' ? data.data : JSON.stringify(data.data);
            appendToolLog(name, 'Success', 'success');
        }
        else if (name === 'get_financing_data') {
            const res = await fetch('/api/voice/financing_data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId })
            });
            const data = await res.json();
            output = typeof data.data === 'string' ? data.data : JSON.stringify(data.data);
            appendToolLog(name, 'Success', 'success');
        }
        else if (name === 'show_visual_component') {
            renderVisualComponent(
                args.component_type,
                args.title || 'Visual Aid',
                args.data || {},
                args.highlight_target,
                args.highlight_effect
            );
            output = `Visual component ${args.component_type} successfully displayed to the user.`;
            appendToolLog(name, 'Component Displayed', 'success');
        }
        else {
            output = `Unknown tool: ${name}`;
        }
    } catch (err) {
        console.error("Tool execution error:", err);
        output = `Error executing tool: ${err.message}`;
    }

    sendEvent({
        type: 'conversation.item.create',
        item: {
            type: 'function_call_output',
            call_id: callId,
            output: output
        }
    });

    completedToolCallIds.add(callId);
    expectedToolCallIds.delete(callId);
    
    checkAndTriggerResponse();
}

function renderVisualComponent(componentType, title, data, highlightTarget, highlightEffect) {
    const visualDeck = document.getElementById('visualDeck');
    if (!visualDeck) return;

    // Clear previous contents
    visualDeck.innerHTML = '';

    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'comp-wrapper';

    // Add Title
    const titleEl = document.createElement('div');
    titleEl.className = 'comp-title';
    titleEl.textContent = title;
    wrapper.appendChild(titleEl);

    // Build specific component template
    let contentHtml = '';
    
    if (componentType === 'savings_calculator') {
        const metrics = {
            system_size: data.system_size || '8.2 kW',
            net_cost: data.net_cost || '$18,200',
            annual_savings: data.annual_savings || '$1,650',
            payback_years: data.payback_years || '7.8 years'
        };
        
        contentHtml = `
            <div class="savings-grid">
                <div class="metric-card" data-key="system_size">
                    <span class="metric-label">System Size</span>
                    <span class="metric-value">${metrics.system_size}</span>
                </div>
                <div class="metric-card" data-key="net_cost">
                    <span class="metric-label">Net Cost (after ITC)</span>
                    <span class="metric-value">${metrics.net_cost}</span>
                </div>
                <div class="metric-card" data-key="annual_savings">
                    <span class="metric-label">Est. Annual Savings</span>
                    <span class="metric-value">${metrics.annual_savings}</span>
                </div>
                <div class="metric-card" data-key="payback_years">
                    <span class="metric-label">Payback Period</span>
                    <span class="metric-value">${metrics.payback_years}</span>
                </div>
            </div>
        `;
    } 
    else if (componentType === 'product_specs') {
        const specs = {
            product_name: data.product_name || 'Generac PWRcell',
            capacity: data.capacity || '18.0 kWh',
            warranty: data.warranty || '10 Years',
            efficiency: data.efficiency || '96.5%'
        };
        
        contentHtml = `
            <div class="specs-list">
                <div class="spec-item" data-key="product_name">
                    <span class="spec-name">Product Name</span>
                    <span class="spec-val">${specs.product_name}</span>
                </div>
                <div class="spec-item" data-key="capacity">
                    <span class="spec-name">Battery Capacity</span>
                    <span class="spec-val">${specs.capacity}</span>
                </div>
                <div class="spec-item" data-key="warranty">
                    <span class="spec-name">Equipment Warranty</span>
                    <span class="spec-val">${specs.warranty}</span>
                </div>
                <div class="spec-item" data-key="efficiency">
                    <span class="spec-name">Round-Trip Efficiency</span>
                    <span class="spec-val">${specs.efficiency}</span>
                </div>
            </div>
        `;
    } 
    else if (componentType === 'comparison_matrix') {
        const rows = data.rows || [
            { feature: 'Blackout Protection', grid: '❌ None', solar: '⚡ Whole-Home Backup' },
            { feature: 'Monthly Rate Stability', grid: '📈 Escalating ~4-6%/yr', solar: '🔒 Fixed (Own Your Power)' },
            { feature: 'Environmental Impact', grid: '🪨 High Carbon Grid', solar: '🌿 100% Clean Energy' },
            { feature: '25-Year Cost Projection', grid: '💸 $68,000+ paid to utility', solar: '💰 $18,200 asset value' }
        ];
        
        let rowHtml = rows.map((r, index) => `
            <tr data-key="row-${index}">
                <td><strong>${r.feature}</strong></td>
                <td style="color: #ff3366">${r.grid}</td>
                <td style="color: #00ff88; font-weight: 600">${r.solar}</td>
            </tr>
        `).join('');

        contentHtml = `
            <div class="matrix-table-wrapper">
                <table class="matrix-table">
                    <thead>
                        <tr>
                            <th>Feature</th>
                            <th>Traditional Grid</th>
                            <th>Generac Solar + Storage</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowHtml}
                    </tbody>
                </table>
            </div>
        `;
    } 
    else if (componentType === 'energy_flow') {
        const flow = {
            solar_generation: data.solar_generation || '5.4 kW',
            battery_charge: data.battery_charge || '84%',
            home_load: data.home_load || '1.8 kW',
            grid_status: data.grid_status || '0.0 kW (Idle)'
        };
        
        contentHtml = `
            <div class="flow-diagram">
                <div class="flow-node" data-key="solar_generation">
                    <span class="flow-node-title">Solar Panels</span>
                    <span class="flow-node-val">☀️ ${flow.solar_generation}</span>
                </div>
                <div class="flow-connection">
                    <span class="flow-arrow">➡️</span>
                    <span class="flow-label">charging</span>
                </div>
                <div class="flow-node" data-key="battery_charge">
                    <span class="flow-node-title">PWRcell Battery</span>
                    <span class="flow-node-val">🔋 ${flow.battery_charge}</span>
                </div>
                <div class="flow-connection">
                    <span class="flow-arrow">➡️</span>
                    <span class="flow-label">powering</span>
                </div>
                <div class="flow-node" data-key="home_load">
                    <span class="flow-node-title">Home Load</span>
                    <span class="flow-node-val">🏠 ${flow.home_load}</span>
                </div>
            </div>
        `;
    }
    else if (componentType === 'outage_timeline') {
        const steps = data.steps || [
            { time: '0:00', event: 'Grid Power Fails', desc: 'Utility power is lost.' },
            { time: '0:02', event: 'Transfer Switch Opens', desc: 'Home is isolated from the grid.' },
            { time: '0:10', event: 'Generator Starts', desc: 'Generac generator restores home power.' },
            { time: 'Restored', event: 'Grid Returns', desc: 'Generator stops, solar resumes normal operation.' }
        ];
        
        let timelineHtml = steps.map((s, index) => `
            <div class="timeline-step" data-key="step-${index}">
                <div class="step-time">${s.time}</div>
                <div class="step-content">
                    <div class="step-event">${s.event}</div>
                    <div class="step-desc">${s.desc}</div>
                </div>
            </div>
        `).join('');

        contentHtml = `
            <div class="outage-timeline">
                ${timelineHtml}
            </div>
        `;
    }
    else if (componentType === 'bill_comparison') {
        const old_bill = data.old_bill || '$250';
        const new_utility = data.new_utility || '$45';
        const solar_payment = data.solar_payment || '$145';
        const total_new = data.total_new || '$190';
        
        contentHtml = `
            <div class="bill-comparison">
                <div class="bill-card old-bill" data-key="old_bill">
                    <div class="bill-title">Current Utility Bill</div>
                    <div class="bill-amount">${old_bill}</div>
                </div>
                <div class="bill-vs">VS</div>
                <div class="bill-card new-bill">
                    <div class="bill-title">New Total Energy Cost</div>
                    <div class="bill-amount" data-key="total_new">${total_new}</div>
                    <div class="bill-breakdown">
                        <div class="breakdown-item" data-key="solar_payment">
                            <span>Solar Subscription:</span> <span>${solar_payment}</span>
                        </div>
                        <div class="breakdown-item" data-key="new_utility">
                            <span>Remaining Utility:</span> <span>${new_utility}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    else if (componentType === 'metric_graph') {
        const x_labels = data.x_labels || [];
        const y_axis_label = data.y_axis_label || '';
        
        let series = [];
        if (data.series && Array.isArray(data.series)) {
            series = data.series;
        } else if (data.y_values && Array.isArray(data.y_values)) {
            series = [{
                name: data.series_name || 'Metric',
                values: data.y_values,
                color: data.color_theme || 'orange'
            }];
        } else {
            series = [
                {
                    name: 'Traditional Grid',
                    values: [2500, 3100, 3850, 4800, 6000, 7500],
                    color: 'red'
                },
                {
                    name: 'Generac Solar',
                    values: [2200, 2300, 2400, 2500, 2600, 2700],
                    color: 'green'
                }
            ];
        }

        if (x_labels.length === 0) {
            x_labels.push('Year 1', 'Year 5', 'Year 10', 'Year 15', 'Year 20', 'Year 25');
        }

        const svgWidth = 500;
        const svgHeight = 280;
        const xMin = 65;
        const xMax = 475;
        const yMin = 30;
        const yMax = 230;

        let maxVal = 0;
        series.forEach(s => {
            s.values.forEach(v => {
                if (v > maxVal) maxVal = v;
            });
        });
        if (maxVal === 0) maxVal = 100;
        
        let roundFactor = Math.pow(10, Math.floor(Math.log10(maxVal)) - 1);
        if (roundFactor < 1) roundFactor = 1;
        maxVal = Math.ceil(maxVal / roundFactor) * roundFactor;

        const gridLinesCount = 4;
        let gridLinesHtml = '';
        for (let i = 0; i <= gridLinesCount; i++) {
            const val = (maxVal / gridLinesCount) * i;
            const y = yMax - (val / maxVal) * (yMax - yMin);
            let valLabel = val >= 1000 ? (val / 1000).toFixed(1).replace('.0', '') + 'k' : val;
            if (y_axis_label.includes('$') || series.some(s => s.values.some(v => v > 100))) {
                valLabel = '$' + valLabel;
            }
            gridLinesHtml += `
                <line x1="${xMin}" y1="${y}" x2="${xMax}" y2="${y}" stroke="rgba(255, 255, 255, 0.08)" stroke-width="1" stroke-dasharray="4 4" />
                <text x="${xMin - 10}" y="${y + 4}" fill="rgba(255, 255, 255, 0.5)" font-size="10" text-anchor="end" font-family="Outfit">${valLabel}</text>
            `;
        }

        let xLabelsHtml = '';
        const xPointsCount = x_labels.length;
        const xStep = (xMax - xMin) / (xPointsCount - 1);
        x_labels.forEach((label, i) => {
            const x = xMin + i * xStep;
            xLabelsHtml += `
                <text x="${x}" y="${yMax + 20}" fill="rgba(255, 255, 255, 0.5)" font-size="10" text-anchor="middle" font-family="Outfit">${label}</text>
            `;
        });

        let seriesHtml = '';
        let legendHtml = '';
        
        const themeColors = {
            red: { stroke: '#ff3366', glow: 'rgba(255, 51, 102, 0.3)', gradStart: 'rgba(255, 51, 102, 0.25)', gradEnd: 'rgba(255, 51, 102, 0)' },
            green: { stroke: '#00ff88', glow: 'rgba(0, 255, 136, 0.3)', gradStart: 'rgba(0, 255, 136, 0.25)', gradEnd: 'rgba(0, 255, 136, 0)' },
            blue: { stroke: '#0088ff', glow: 'rgba(0, 136, 255, 0.3)', gradStart: 'rgba(0, 136, 255, 0.25)', gradEnd: 'rgba(0, 136, 255, 0)' },
            orange: { stroke: '#ff6b00', glow: 'rgba(255, 107, 0, 0.3)', gradStart: 'rgba(255, 107, 0, 0.25)', gradEnd: 'rgba(255, 107, 0, 0)' }
        };

        series.forEach((s, sIdx) => {
            const theme = themeColors[s.color] || themeColors.orange;
            const points = [];
            
            s.values.forEach((val, i) => {
                const x = xMin + i * xStep;
                const y = yMax - (val / maxVal) * (yMax - yMin);
                points.push({ x, y, val });
            });

            let pathD = '';
            points.forEach((p, i) => {
                if (i === 0) pathD += `M ${p.x} ${p.y}`;
                else pathD += ` L ${p.x} ${p.y}`;
            });

            const areaD = `${pathD} L ${points[points.length - 1].x} ${yMax} L ${points[0].x} ${yMax} Z`;

            let circlesHtml = '';
            points.forEach((p, i) => {
                circlesHtml += `
                    <g class="graph-point" data-key="point-${sIdx}-${i}">
                        <circle cx="${p.x}" cy="${p.y}" r="4" fill="${theme.stroke}" stroke="#ffffff" stroke-width="1.5" />
                        <circle cx="${p.x}" cy="${p.y}" r="8" fill="none" stroke="${theme.stroke}" stroke-width="1" opacity="0" class="point-glow" />
                    </g>
                `;
            });

            seriesHtml += `
                <defs>
                    <linearGradient id="grad-${sIdx}" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stop-color="${theme.gradStart}" />
                        <stop offset="100%" stop-color="${theme.gradEnd}" />
                    </linearGradient>
                </defs>
                <path d="${areaD}" fill="url(#grad-${sIdx})" opacity="0.15" />
                <path d="${pathD}" fill="none" stroke="${theme.stroke}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 2px 6px ${theme.glow});" />
                ${circlesHtml}
            `;

            legendHtml += `
                <div class="legend-item">
                    <span class="legend-color" style="background-color: ${theme.stroke}; box-shadow: 0 0 6px ${theme.glow}"></span>
                    <span class="legend-name">${s.name}</span>
                </div>
            `;
        });

        contentHtml = `
            <div class="graph-container">
                <div class="graph-svg-wrapper">
                    <svg viewBox="0 0 ${svgWidth} ${svgHeight}" width="100%" height="100%">
                        <text x="15" y="${(yMin + yMax)/2}" transform="rotate(-90 15 ${(yMin + yMax)/2})" fill="rgba(255, 255, 255, 0.4)" font-size="10" text-anchor="middle" font-family="Outfit" letter-spacing="0.5">${y_axis_label}</text>
                        ${gridLinesHtml}
                        <line x1="${xMin}" y1="${yMax}" x2="${xMax}" y2="${yMax}" stroke="rgba(255, 255, 255, 0.15)" stroke-width="1" />
                        ${xLabelsHtml}
                        ${seriesHtml}
                    </svg>
                </div>
                <div class="graph-legend">
                    ${legendHtml}
                </div>
            </div>
        `;
    }

    const container = document.createElement('div');
    container.innerHTML = contentHtml;
    wrapper.appendChild(container.firstElementChild);
    visualDeck.appendChild(wrapper);

    // Apply Highlight target and effect
    if (highlightTarget && highlightEffect) {
        // Find element by data-key attribute matching highlightTarget
        const targetEl = wrapper.querySelector(`[data-key="${highlightTarget}"]`);
        if (targetEl) {
            applyHighlight(targetEl, highlightEffect);
        } else {
            // fallback: check if target is an index (like row-1) or fuzzy match text
            const fuzzyEl = Array.from(wrapper.querySelectorAll('[data-key]')).find(el => 
                el.getAttribute('data-key').toLowerCase().includes(highlightTarget.toLowerCase())
            );
            if (fuzzyEl) {
                applyHighlight(fuzzyEl, highlightEffect);
            }
        }
    }
}

function applyHighlight(element, effect) {
    if (effect === 'glow') {
        if (element.tagName === 'g' || element.classList.contains('graph-point')) {
            element.classList.add('highlight-glow-point');
        } else {
            element.classList.add('highlight-glow');
        }
    } 
    else if (effect === 'circle') {
        element.classList.add('circle-container');
        // Inject an SVG circle overlay
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'circle-svg');
        svg.setAttribute('viewBox', '0 0 100 100');
        svg.setAttribute('preserveAspectRatio', 'none');
        
        // draw a slightly irregular circle path for natural feel
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('class', 'circle-path');
        path.setAttribute('d', 'M 5,50 A 45,45 0 1,0 95,50 A 45,45 0 1,0 5,50 Z');
        
        svg.appendChild(path);
        element.appendChild(svg);
    } 
    else if (effect === 'underline') {
        element.classList.add('underline-container');
        const underline = document.createElement('div');
        underline.setAttribute('class', 'underline-bar');
        element.appendChild(underline);
    }
}

function resetVisualDeck() {
    const visualDeck = document.getElementById('visualDeck');
    if (!visualDeck) return;
    visualDeck.innerHTML = `
        <div class="visual-placeholder">
            <div class="pulse-ring"></div>
            <svg class="placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M21 12H3M12 3v18M16 8l-2 2-2-2M8 16l2-2 2 2" />
            </svg>
            <p>Visual aids will appear here dynamically as the advisor speaks.</p>
        </div>
    `;
}

function checkAndTriggerResponse() {
    if (responseDoneReceived && expectedToolCallIds.size === 0) {
        // If there were function calls in the previous response, trigger model again
        if (completedToolCallIds.size > 0) {
            sendEvent({ type: 'response.create' });
        }
    }
}

function sendEvent(eventObj) {
    if (dataChannel && dataChannel.readyState === 'open') {
        dataChannel.send(JSON.stringify(eventObj));
    }
}

function disconnect() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    if (mediaStream) {
        mediaStream.getTracks().forEach(t => t.stop());
        mediaStream = null;
    }
    dataChannel = null;
    resetVisualDeck();
    setStatus('disconnected');
}

// Event Listeners
connectBtn.addEventListener('click', initWebRTC);
disconnectBtn.addEventListener('click', disconnect);
