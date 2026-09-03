import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface DropdownMenuProps {
  children: React.ReactNode;
}

interface DropdownContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.MutableRefObject<HTMLElement | null>;
}

const DropdownContext = React.createContext<DropdownContextValue>({
  open: false,
  setOpen: () => {},
  triggerRef: { current: null },
});

function DropdownMenu({ children }: DropdownMenuProps) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLElement | null>(null);

  return (
    <DropdownContext.Provider value={{ open, setOpen, triggerRef }}>
      <div className="relative inline-block text-left">{children}</div>
    </DropdownContext.Provider>
  );
}

function DropdownMenuTrigger({
  children,
  asChild,
}: {
  children: React.ReactNode;
  asChild?: boolean;
}) {
  const { open, setOpen, triggerRef } = React.useContext(DropdownContext);

  if (asChild && React.isValidElement(children)) {
    return (
      <span ref={(element) => { triggerRef.current = element; }} className="inline-flex">
        {React.cloneElement(children as React.ReactElement<{ onClick?: () => void }>, {
          onClick: () => setOpen(!open),
        })}
      </span>
    );
  }

  return (
    <button
      ref={(element) => { triggerRef.current = element; }}
      type="button"
      onClick={() => setOpen(!open)}
      aria-expanded={open}
      aria-haspopup="menu"
    >
      {children}
    </button>
  );
}

function DropdownMenuContent({
  children,
  className,
  align = "end",
}: {
  children: React.ReactNode;
  className?: string;
  align?: "start" | "end";
}) {
  const { open, setOpen, triggerRef } = React.useContext(DropdownContext);
  const ref = React.useRef<HTMLDivElement>(null);
  const [position, setPosition] = React.useState<{ top: number; left: number } | null>(null);

  const updatePosition = React.useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    setPosition({
      top: rect.bottom + 8,
      left: align === "end" ? rect.right : rect.left,
    });
  }, [align, triggerRef]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!ref.current?.contains(target) && !triggerRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, setOpen, triggerRef]);

  React.useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  if (!open) return null;

  return createPortal(
    <div
      ref={ref}
      className={cn(
        "fixed z-[100] min-w-[11rem] rounded-lg border border-gray-200 bg-white p-1.5 shadow-xl shadow-gray-900/10 dark:border-gray-700 dark:bg-gray-800",
        className
      )}
      style={position ? {
        top: position.top,
        left: position.left,
        transform: align === "end" ? "translateX(-100%)" : undefined,
      } : { visibility: "hidden" }}
      role="menu"
    >
      {children}
    </div>,
    document.body
  );
}

function DropdownMenuItem({
  children,
  className,
  onClick,
  destructive,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  destructive?: boolean;
}) {
  const { setOpen } = React.useContext(DropdownContext);

  return (
    <button
      type="button"
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center gap-2 whitespace-nowrap rounded-md px-2.5 py-2 text-sm font-medium leading-5 outline-none transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700",
        destructive && "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30",
        className
      )}
      onClick={() => {
        onClick?.();
        setOpen(false);
      }}
    >
      {children}
    </button>
  );
}

function DropdownMenuSeparator({ className }: { className?: string }) {
  return <div className={cn("-mx-0.5 my-1 h-px bg-gray-200 dark:bg-gray-700", className)} />;
}

function DropdownMenuLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("px-2 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400", className)}>
      {children}
    </div>
  );
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
};
