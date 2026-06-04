import type { FormEvent, KeyboardEvent, ReactNode } from "react";

const ROOT = "sunny-chat";

export type ChatComposerProps = {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
  /** Slot above textarea (e.g. quick replies). */
  slotBefore?: ReactNode;
};

export function ChatComposer({
  value,
  onChange,
  onSend,
  disabled,
  placeholder = "Message…",
  slotBefore,
}: ChatComposerProps) {
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && value.trim()) onSend();
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!disabled && value.trim()) onSend();
  };

  return (
    <form className={`${ROOT}__composer`} onSubmit={onSubmit}>
      {slotBefore}
      <div className={`${ROOT}__composerRow`}>
        <textarea
          className={`${ROOT}__input`}
          rows={2}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          aria-label="Chat message"
        />
        <button
          type="submit"
          className={`${ROOT}__send`}
          disabled={disabled || !value.trim()}
        >
          Send
        </button>
      </div>
    </form>
  );
}
