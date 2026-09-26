import { useScrollReveal } from "../../hooks/useScrollReveal";

export default function Reveal({ as: Tag = "div", delay = 0, className = "", style, children, ...rest }) {
  const [ref, isVisible] = useScrollReveal();

  return (
    <Tag
      ref={ref}
      style={{ animationDelay: `${delay}ms`, ...style }}
      className={`${className} ${isVisible ? "animate-fade-slide-up" : "opacity-0"}`.trim()}
      {...rest}
    >
      {children}
    </Tag>
  );
}
