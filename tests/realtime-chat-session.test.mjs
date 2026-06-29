import test from "node:test";
import assert from "node:assert/strict";
import { createRealtimeChatSession } from "../dist/index.js";

class FakeDataChannel {
  constructor() {
    this.readyState = "connecting";
    this.listeners = { open: [], close: [], error: [], message: [] };
    this.sent = [];
  }

  addEventListener(type, listener) {
    this.listeners[type].push(listener);
  }

  send(payload) {
    this.sent.push(JSON.parse(payload));
  }

  close() {
    this.readyState = "closed";
    this.emit("close", {});
  }

  open() {
    this.readyState = "open";
    this.emit("open", {});
  }

  emit(type, event) {
    for (const listener of this.listeners[type]) {
      listener(event);
    }
  }

  emitMessage(payload) {
    this.emit("message", { data: JSON.stringify(payload) });
  }
}

class FakePeerConnection {
  constructor(channel) {
    this.channel = channel;
    this.ontrack = null;
    this.closed = false;
    this.tracks = [];
  }

  createDataChannel() {
    return this.channel;
  }

  async createOffer() {
    return { sdp: "offer-sdp" };
  }

  async setLocalDescription(desc) {
    this.localDescription = desc;
  }

  async setRemoteDescription(desc) {
    this.remoteDescription = desc;
    this.channel.open();
  }

  addTrack(track, stream) {
    this.tracks.push({ track, stream });
  }

  close() {
    this.closed = true;
  }

  emitTrack(stream) {
    this.ontrack?.({ streams: [stream] });
  }
}

function createTrack() {
  return {
    stopped: false,
    stop() {
      this.stopped = true;
    },
  };
}

function createMediaStream() {
  const track = createTrack();
  return {
    track,
    getTracks() {
      return [track];
    },
  };
}

function createHarness(overrides = {}) {
  const channel = new FakeDataChannel();
  const mediaStream = createMediaStream();
  const peer = new FakePeerConnection(channel);
  const audio = { autoplay: false, srcObject: null };
  const session = createRealtimeChatSession({
    getUserId: () => "voice-user",
    getSessionToken: async () => "ephemeral-token",
    openAiBaseUrl: "https://realtime.example.test/calls",
    fetchImpl: async (url) => {
      if (String(url).includes("realtime.example.test")) {
        return {
          ok: true,
          text: async () => "answer-sdp",
        };
      }
      throw new Error(`Unexpected fetch: ${url}`);
    },
    rtcFactories: {
      createPeerConnection: () => peer,
      getUserMedia: async () => mediaStream,
      createAudioElement: () => audio,
    },
    ...overrides,
  });
  return { session, channel, mediaStream, peer, audio };
}

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

test("typed sends create a user message and emit realtime events", async () => {
  const { session, channel } = createHarness();
  await session.connect();
  channel.sent.length = 0;

  const sent = session.sendText("Hello from keyboard");

  assert.equal(sent, true);
  assert.deepEqual(
    channel.sent.map((entry) => entry.type),
    ["conversation.item.create", "response.create"],
  );
  assert.equal(session.getSnapshot().messages.at(-1)?.content, "Hello from keyboard");
});

test("audio transcription and assistant text events become chat bubbles", async () => {
  const { session, channel } = createHarness();
  await session.connect();

  channel.emitMessage({
    type: "conversation.item.input_audio_transcription.completed",
    transcript: "How much will I save?",
  });
  channel.emitMessage({ type: "response.created" });
  channel.emitMessage({ type: "response.output_text.delta", response_id: "r1", item_id: "a1", delta: "You can save " });
  channel.emitMessage({ type: "response.output_text.delta", response_id: "r1", item_id: "a1", delta: "$120/mo" });
  channel.emitMessage({ type: "response.output_text.done", response_id: "r1", item_id: "a1", text: "You can save $120/mo" });

  const messages = session.getSnapshot().messages;
  assert.deepEqual(
    messages.map((message) => [message.role, message.content]),
    [
      ["user", "How much will I save?"],
      ["assistant", "You can save $120/mo"],
    ],
  );
});

test("tool calls accumulate args, dispatch once, and trigger follow-up response", async () => {
  const { session, channel } = createHarness({
    toolHandlers: {
      search_docs: async (args) => `context for ${args.query}`,
    },
  });
  await session.connect();
  channel.sent.length = 0;

  channel.emitMessage({ type: "response.created" });
  channel.emitMessage({
    type: "response.function_call_arguments.delta",
    call_id: "call-1",
    name: "search_docs",
    delta: '{"query":"solar',
  });
  channel.emitMessage({
    type: "response.function_call_arguments.done",
    call_id: "call-1",
    name: "search_docs",
    arguments: '{"query":"solar savings"}',
  });
  channel.emitMessage({
    type: "response.done",
    response: {
      output: [{ type: "function_call", call_id: "call-1" }],
    },
  });

  await flush();

  const types = channel.sent.map((entry) => entry.type);
  assert.equal(types.filter((type) => type === "conversation.item.create").length, 1);
  assert.equal(types.filter((type) => type === "response.create").length, 1);
  const outputEvent = channel.sent.find((entry) => entry.type === "conversation.item.create");
  assert.equal(outputEvent.item.type, "function_call_output");
  assert.equal(outputEvent.item.output, "context for solar savings");
  assert.deepEqual(session.getSnapshot().toolInvocations, [
    {
      id: "call-1",
      name: "search_docs",
      state: "complete",
      args: { query: "solar savings" },
      result: "context for solar savings",
    },
  ]);
});

test("disconnect stops tracks and connection state reacts to speaking/listening transitions", async () => {
  const { session, channel, mediaStream, peer, audio } = createHarness();
  await session.connect();

  peer.emitTrack({ id: "audio-stream" });
  assert.equal(session.getSnapshot().connectionState, "speaking");
  assert.deepEqual(audio.srcObject, { id: "audio-stream" });

  channel.emitMessage({ type: "response.audio.done" });
  assert.equal(session.getSnapshot().connectionState, "listening");

  session.disconnect();
  assert.equal(session.getSnapshot().connectionState, "disconnected");
  assert.equal(mediaStream.track.stopped, true);
  assert.equal(peer.closed, true);
});
