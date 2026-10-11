import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="top-center"
      className="toaster group"
      offset="calc(env(safe-area-inset-top, 0px) + 12px)"
      mobileOffset="calc(env(safe-area-inset-top, 0px) + 12px)"
      style={{
        width: "calc(100vw - 16px)",
        maxWidth: "calc(100vw - 16px)",
        left: "8px",
        right: "8px",
      }}
      toastOptions={{
        unstyled: false,
        duration: 2600,
        style: { width: "100%", maxWidth: "100%" },
        classNames: {
          toast:
            "group toast !w-full !rounded-2xl !border !backdrop-blur-xl !px-4 !py-3.5 !gap-3 !text-[14px] !font-semibold !tracking-[-0.01em] !shadow-[0_18px_40px_-12px_hsl(var(--foreground)/0.18),0_0_0_1px_hsl(var(--primary)/0.14)] group-[.toaster]:bg-[hsl(var(--card)/0.96)] group-[.toaster]:text-card-foreground group-[.toaster]:border-[hsl(var(--primary)/0.28)]",
          title: "!text-card-foreground !font-bold !tracking-[-0.01em]",
          description: "!text-card-foreground/75 !text-[12.5px] !font-medium",
          icon: "!text-primary",
          success: "!bg-[hsl(var(--card)/0.96)] !text-card-foreground [&_svg]:!text-primary",
          error: "!bg-[hsl(var(--card)/0.96)] !text-card-foreground [&_svg]:!text-destructive",
          info: "!bg-[hsl(var(--card)/0.96)] !text-card-foreground",
          warning: "!bg-[hsl(var(--card)/0.96)] !text-card-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground !rounded-lg !font-bold",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground !rounded-lg",
        },
      }}
      richColors={false}
      closeButton={false}
      {...props}
    />
  );
};

export { Toaster, toast };
