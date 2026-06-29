export type MockScenario = {
  id: string;
  question: string;
  response: string;
};

export const MOCK_SCENARIOS: MockScenario[] = [
  {
    id: "next-steps",
    question: "What are my next steps?",
    response:
      "Here are your **next steps**:\n\n1. Review your personalized offer\n2. Schedule your installation date\n3. Set up billing in the customer portal\n\nLet me know if you'd like help with any of these!",
  },
  {
    id: "billing",
    question: "How does billing work?",
    response:
      "Billing is simple:\n\n- You pay a **monthly subscription** based on your plan\n- Invoices are emailed on the 1st of each month\n- You can update payment methods anytime in **Settings → Billing**\n\nNo hidden fees — your contract lists all charges upfront.",
  },
  {
    id: "timeline",
    question: "When will installation happen?",
    response:
      "Typical installation timeline:\n\n| Phase | Duration |\n|-------|----------|\n| Site survey | 3–5 business days |\n| Permits (if needed) | 1–2 weeks |\n| Installation | 1 day |\n\nWe'll text you when your slot is confirmed.",
  },
  {
    id: "markdown",
    question: "Show me a code example",
    response:
      "Sure! Here's a tiny example:\n\n```js\nconst session = buildSessionId({\n  userId: \"user-123\",\n  sessionIdSuffix: \"_demo\",\n});\nconsole.log(session);\n```\n\nThis builds the session id sent with each chat request.",
  },
  {
    id: "fallback",
    question: "Tell me something random",
    response:
      "I'm a **mock assistant** in the SunnyChat playground. Try one of the quick-reply chips or type a question that matches a scenario on the left.",
  },
];

export const DEFAULT_MOCK_RESPONSE =
  "I don't have a scripted answer for that, but the mock server is working! Try one of the preset questions from the sidebar, or use the quick-reply chips.";

export function resolveMockResponse(
  message: string,
  scenarios: MockScenario[] = MOCK_SCENARIOS,
): string {
  const normalized = message.trim().toLowerCase();
  const exact = scenarios.find(
    (s) => s.question.trim().toLowerCase() === normalized,
  );
  if (exact) return exact.response;

  const partial = scenarios.find((s) =>
    normalized.includes(s.question.trim().toLowerCase()),
  );
  if (partial) return partial.response;

  return DEFAULT_MOCK_RESPONSE;
}
