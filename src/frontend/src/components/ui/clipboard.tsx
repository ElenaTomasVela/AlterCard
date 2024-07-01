import { Icon } from "@iconify/react/dist/iconify.js";
import { useEffect, useState } from "react";

export default function ClipboardButton({ toCopy }: { toCopy: string }) {
  const [copying, setCopying] = useState(false);

  function copy(): void {
    setCopying(true);
    navigator.clipboard.writeText(location.href);
  }
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (copying) setCopying(false);
    }, 1000);

    return () => clearTimeout(timeout);
  }, [copying]);

  return (
    <button onClick={copy} className="relative h-fit">
      <Icon
        icon="lucide:copy"
        className={`size-6 [stroke-dasharray:60px] transition-all ease-in-out duration-200 ${copying ? "[stroke-dashoffset:-60]" : "delay-200"}`}
      />
      <Icon
        icon="lucide:check"
        className={`absolute size-6 bottom-0 right-0 text-green-600
        [stroke-dasharray:60px] transition-all ease-in-out duration-200
        ${copying ? "[stroke-dashoffset:0] delay-200" : "[stroke-dashoffset:-60]"}`}
      />
    </button>
  );
}
