"use client";

import { ChevronDown, HelpCircle, Layers3, X } from "lucide-react";
import { useState } from "react";

const faqs = [
  {
    question: "What is GenStack?",
    answer: "GenStack is an AI-powered platform that generates fully working business applications (dashboards, forms, tables, APIs) from a single text prompt. No coding required."
  },
  {
    question: "What does AI Studio do?",
    answer: "AI Studio is where you write your prompt. Describe the application you need (e.g. 'Build an Employee Management system') and GenStack will generate the complete schema, APIs, and UI automatically."
  },
  {
    question: "How do I generate an app?",
    answer: "Go to AI Studio → write a prompt or pick a Benchmark Prompt → click Generate App → wait 15-30 seconds → click Apply Config → your app is live."
  },
  {
    question: "What is Runtime?",
    answer: "Runtime is the active state of your generated application. It includes the database tables, API endpoints, dashboard pages, and analytics that GenStack created for you."
  },
  {
    question: "How do I export?",
    answer: "After generating an app, go to Export in the sidebar. You can push your configuration to GitHub or download it as a ZIP file."
  }
];

export function HelpButton(): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const toggleFaq = (index: number): void => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <>
      <button
        className="fixed bottom-6 right-6 z-40 grid h-11 w-11 place-items-center rounded-full border border-accent/30 bg-accent/15 text-accent shadow-lg shadow-black/35 backdrop-blur-sm transition hover:bg-accent/25 hover:border-accent/50 hover:scale-105"
        onClick={() => setIsOpen(!isOpen)}
        type="button"
        aria-label="Help"
      >
        {isOpen ? <X className="h-4.5 w-4.5" /> : <HelpCircle className="h-4.5 w-4.5" />}
      </button>

      {isOpen && (
        <div className="fixed bottom-20 right-6 z-40 w-80 rounded-2xl border border-line bg-card shadow-2xl shadow-black/40 animate-in slide-in-from-bottom-3 fade-in duration-200">
          <div className="flex items-center gap-2.5 border-b border-line px-5 py-4">
            <Layers3 className="h-4 w-4 text-accent" />
            <h3 className="text-sm font-bold text-zinc-100">How GenStack Works</h3>
          </div>

          <div className="max-h-80 overflow-y-auto p-2">
            {faqs.map((faq, index) => (
              <div key={faq.question}>
                <button
                  className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-3 text-left text-xs font-semibold text-zinc-300 transition hover:bg-hover"
                  onClick={() => toggleFaq(index)}
                  type="button"
                >
                  {faq.question}
                  <ChevronDown
                    className={`h-3.5 w-3.5 shrink-0 text-zinc-500 transition duration-200 ${
                      expandedIndex === index ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {expandedIndex === index && (
                  <div className="px-3 pb-3 text-[11px] leading-relaxed text-zinc-400 animate-in fade-in slide-in-from-top-1 duration-150">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
