type PostRedirectButtonProps = {
  action: string;
  className: string;
  idleLabel: string;
};

export function PostRedirectButton({
  action,
  className,
  idleLabel
}: PostRedirectButtonProps) {
  return (
    <form action={action} method="post">
      <button className={className} type="submit">
        {idleLabel}
      </button>
    </form>
  );
}
