"use client";

import { useState } from "react";

type PostRedirectButtonProps = {
  action: string;
  className: string;
  idleLabel: string;
  pendingLabel: string;
};

export function PostRedirectButton({
  action,
  className,
  idleLabel,
  pendingLabel
}: PostRedirectButtonProps) {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (pending) return;

    setPending(true);

    try {
      const response = await fetch(action, {
        method: "POST",
        redirect: "follow"
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      window.location.assign(response.url);
    } catch (error) {
      console.error(error);
      window.alert("The action could not be completed. Please refresh and try again.");
      setPending(false);
    }
  }

  return (
    <button className={className} disabled={pending} onClick={handleClick} type="button">
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}
