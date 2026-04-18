"use client";

import { ChangeEvent, ReactNode } from "react";

type InputProps = {
  type?: string;
  placeholder: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  icon?: ReactNode;
};

export default function Input({
  type = "text",
  placeholder,
  value,
  onChange,
  icon,
}: InputProps) {
  return (
    <div className="group flex w-full items-center gap-3 rounded-[22px] border border-slate-200/80 bg-white/90 px-4 py-3.5 text-slate-900 shadow-[0_12px_24px_rgba(15,23,42,0.05)] transition focus-within:-translate-y-0.5 focus-within:border-blue-400 focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(37,99,235,0.12)]">
      {icon && <span className="text-lg text-slate-400 transition group-focus-within:text-blue-600">{icon}</span>}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className="w-full bg-transparent text-slate-900 outline-none placeholder:text-slate-400"
      />
    </div>
  );
}
