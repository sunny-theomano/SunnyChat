import type {
  FormEvent,
  KeyboardEvent,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";

const ROOT = "sunny-chat";

export type ChatComposerUi = {
  /** Appended to `.sunny-chat__composer` */
  formClassName?: string;
  /** Appended to `.sunny-chat__composerRow` */
  rowClassName?: string;
  /** Appended to `.sunny-chat__input` */
  inputClassName?: string;
  /** Appended to `.sunny-chat__send` */
  sendButtonClassName?: string;
  sendButtonLabel?: string;
  /** Merged onto the textarea; `value` / `disabled` are owned by the library. */
  inputProps?: Omit<
    TextareaHTMLAttributes<HTMLTextAreaElement>,
    "value" | "disabled"
  >;
  /** Replace the default submit button; call `send` to submit the current value. */
  renderSendButton?: (ctx: { disabled: boolean; send: () => void }) => ReactNode;
};

export type ChatComposerProps = {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
  /** Slot above textarea (e.g. quick replies). */
  slotBefore?: ReactNode;
  ui?: ChatComposerUi;
};

function cx(...parts: (string | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function ChatComposer({
  value,
  onChange,
  onSend,
  disabled,
  placeholder = "Message…",
  slotBefore,
  ui,
}: ChatComposerProps) {
  const { inputProps, renderSendButton, sendButtonLabel = "Send" } = ui ?? {};
  const {
    className: inputPropsClassName,
    onChange: inputPropsOnChange,
    onKeyDown: inputPropsOnKeyDown,
    ...restInputProps
  } = inputProps ?? {};

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    inputPropsOnKeyDown?.(e);
    if (e.defaultPrevented) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && value.trim()) onSend();
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!disabled && value.trim()) onSend();
  };

  const sendDisabled = Boolean(disabled || !value.trim());
  const triggerSend = () => {
    if (!sendDisabled) onSend();
  };

  return (
    <form
      className={cx(`${ROOT}__composer`, ui?.formClassName)}
      onSubmit={onSubmit}
    >
      {slotBefore}
      <div className={cx(`${ROOT}__composerRow`, ui?.rowClassName)}>
        <textarea
          {...restInputProps}
          className={cx(
            `${ROOT}__input`,
            ui?.inputClassName,
            inputPropsClassName,
          )}
          rows={restInputProps.rows ?? 2}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => {
            inputPropsOnChange?.(e);
            onChange(e.target.value);
          }}
          onKeyDown={onKeyDown}
          aria-label={restInputProps["aria-label"] ?? "Chat message"}
        />
        {renderSendButton ? (
          renderSendButton({ disabled: sendDisabled, send: triggerSend })
        ) : (
          <button
            type="submit"
            className={cx(`${ROOT}__send`, ui?.sendButtonClassName)}
            disabled={sendDisabled}
          >
            {sendButtonLabel}
          </button>
        )}
      </div>
    </form>
  );
}
