import type { ReactNode } from "react";

type Props = {
  title: string;
  description: string;
  children?: ReactNode;
};

export function PagePlaceholder({ title, description, children }: Props) {
  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      {children ? <div className="mt-8">{children}</div> : null}
    </section>
  );
}
