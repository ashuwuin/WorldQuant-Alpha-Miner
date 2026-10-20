import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Bookmark,
  Database,
  FlaskConical,
  Layers,
  Radar,
  Search,
  Sparkles,
  Terminal,
  Wand2,
} from "lucide-react";

export type PaletteItem = {
  id: string;
  category:
    | "PINNED"
    | "WORKSPACE PAGES"
    | "QUICK COMMANDS"
    | "FACTOR BLUEPRINTS"
    | "AUDITED ALPHAS"
    | "BRAIN DATA FIELDS"
    | "FASTEXPR OPERATORS";
  title: string;
  subtitle: string;
  badge?: string;
  rightMeta?: string;
  primaryLabel: string;
  copyText: string;
  studioExpr?: string;
  studioName?: string;
  onPrimary: () => void;
};

type CommandPaletteProps = {
  open: boolean;
  query: string;
  loadingFields: boolean;
  onQueryChange: (q: string) => void;
  onClose: () => void;
  items: PaletteItem[];
  onCopy: (text: string, label: string) => void;
  onLoadInStudio: (expr: string, name?: string) => void;
};

const PINS_STORAGE_KEY = "wq_raycast_pins_v2";

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  query,
  loadingFields,
  onQueryChange,
  onClose,
  items,
  onCopy,
  onLoadInStudio,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [subMenuOpen, setSubMenuOpen] = useState(false);
  const [subMenuIndex, setSubMenuIndex] = useState(0);
  const [working, setWorking] = useState(false);
  const [pins, setPins] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(PINS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : ["page-overview", "page-personal"];
    } catch {
      return ["page-overview", "page-personal"];
    }
  });

  useEffect(() => {
    if (!open) return;
    setWorking(true);
    const t = window.setTimeout(() => setWorking(false), 200);
    return () => clearTimeout(t);
  }, [query, open]);

  useEffect(() => {
    if (open) {
      setSubMenuOpen(false);
      setActiveIndex(0);
      window.setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const togglePin = (id: string) => {
    setPins((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [id, ...prev];
      try {
        localStorage.setItem(PINS_STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const orderedItems = useMemo(() => {
    const pinnedSet = new Set(pins);
    const pinnedItems: PaletteItem[] = [];
    const restItems: PaletteItem[] = [];
    for (const item of items) {
      if (pinnedSet.has(item.id) && !query.trim()) {
        pinnedItems.push({ ...item, category: "PINNED" });
      } else {
        restItems.push(item);
      }
    }
    return [...pinnedItems, ...restItems];
  }, [items, pins, query]);

  useEffect(() => {
    setActiveIndex(0);
    setSubMenuOpen(false);
  }, [query]);

  const activeItem = orderedItems[activeIndex] || orderedItems[0] || null;

  const subActions = useMemo(() => {
    if (!activeItem) return [];
    const list: { label: string; shortcut: string; run: () => void }[] = [
      {
        label: activeItem.primaryLabel,
        shortcut: "↵",
        run: () => {
          activeItem.onPrimary();
          onClose();
        },
      },
      {
        label: "Copy Identifier",
        shortcut: "⌘C",
        run: () => {
          onCopy(activeItem.copyText, activeItem.title);
          setSubMenuOpen(false);
        },
      },
    ];
    if (activeItem.studioExpr) {
      const expr = activeItem.studioExpr;
      const name = activeItem.studioName;
      list.push({
        label: "Clone into Alpha Studio",
        shortcut: "⌘E",
        run: () => {
          onLoadInStudio(expr, name);
          onClose();
        },
      });
    }
    list.push({
      label: pins.includes(activeItem.id)
        ? "Unpin from Top"
        : "Pin to Top of Search",
      shortcut: "⌘P",
      run: () => {
        togglePin(activeItem.id);
        setSubMenuOpen(false);
      },
    });
    return list;
  }, [activeItem, onClose, onCopy, onLoadInStudio, pins]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        e.stopPropagation();
        if (orderedItems.length > 0) {
          setSubMenuOpen((prev) => !prev);
          setSubMenuIndex(0);
        }
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (subMenuOpen) {
          setSubMenuOpen(false);
        } else {
          onClose();
        }
        return;
      }

      if (subMenuOpen) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSubMenuIndex((i) => (i + 1) % Math.max(1, subActions.length));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSubMenuIndex(
            (i) =>
              (i - 1 + Math.max(1, subActions.length)) %
              Math.max(1, subActions.length),
          );
        } else if (e.key === "Enter") {
          e.preventDefault();
          subActions[subMenuIndex]?.run();
        }
        return;
      }

      if (
        (e.metaKey || e.ctrlKey) &&
        e.key.toLowerCase() === "c" &&
        activeItem
      ) {
        if (!window.getSelection()?.toString()) {
          e.preventDefault();
          onCopy(activeItem.copyText, activeItem.title);
        }
        return;
      }

      if (
        (e.metaKey || e.ctrlKey) &&
        e.key.toLowerCase() === "p" &&
        activeItem
      ) {
        e.preventDefault();
        togglePin(activeItem.id);
        return;
      }

      if (
        (e.metaKey || e.ctrlKey) &&
        e.key.toLowerCase() === "e" &&
        activeItem?.studioExpr
      ) {
        e.preventDefault();
        onLoadInStudio(activeItem.studioExpr, activeItem.studioName);
        onClose();
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => {
          const next = (i + 1) % Math.max(1, orderedItems.length);
          const row = listRef.current?.querySelector(`[data-row-idx="${next}"]`);
          row?.scrollIntoView({ block: "nearest" });
          return next;
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => {
          const next =
            (i - 1 + Math.max(1, orderedItems.length)) %
            Math.max(1, orderedItems.length);
          const row = listRef.current?.querySelector(`[data-row-idx="${next}"]`);
          row?.scrollIntoView({ block: "nearest" });
          return next;
        });
      } else if (e.key === "Enter" && activeItem) {
        e.preventDefault();
        activeItem.onPrimary();
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [
    open,
    subMenuOpen,
    subActions,
    subMenuIndex,
    orderedItems,
    activeItem,
    onClose,
    onCopy,
    onLoadInStudio,
  ]);

  if (!open) return null;

  let runningIdx = 0;
  const groups: {
    category: string;
    rows: { item: PaletteItem; idx: number }[];
  }[] = [];
  for (const item of orderedItems) {
    let grp = groups.find((g) => g.category === item.category);
    if (!grp) {
      grp = { category: item.category, rows: [] };
      groups.push(grp);
    }
    grp.rows.push({ item, idx: runningIdx++ });
  }

  const iconForCategory = (cat: PaletteItem["category"]) => {
    switch (cat) {
      case "PINNED":
        return <Bookmark size={14} />;
      case "WORKSPACE PAGES":
        return <Layers size={14} />;
      case "QUICK COMMANDS":
        return <Sparkles size={14} />;
      case "FACTOR BLUEPRINTS":
        return <Wand2 size={14} />;
      case "AUDITED ALPHAS":
        return <Radar size={14} />;
      case "BRAIN DATA FIELDS":
        return <Database size={14} />;
      case "FASTEXPR OPERATORS":
        return <Terminal size={14} />;
      default:
        return <FlaskConical size={14} />;
    }
  };

  return (
    <div className="raycast-backdrop" onClick={onClose} role="presentation">
      <div
        className="raycast-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command Palette"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="raycast-search-head">
          <Search size={17} className="raycast-search-icon" />
          <input
            ref={inputRef}
            className="raycast-search-input no-cursor-lock"
            placeholder="Search pages, commands, alphas, or 4,367 BRAIN fields…"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
          />
          {query && (
            <button
              type="button"
              className="raycast-clear-btn"
              onClick={() => onQueryChange("")}
            >
              Clear
            </button>
          )}
          <kbd className="raycast-esc-kbd">ESC</kbd>
        </div>

        <div
          className={`raycast-work-line ${working || loadingFields ? "is-working" : ""}`}
        />

        <div className="raycast-results" ref={listRef}>
          {groups.map((group) => (
            <div className="raycast-group" key={group.category}>
              <div className="raycast-group-title">{group.category}</div>
              {group.rows.map(({ item, idx }) => {
                const isSelected = idx === activeIndex;
                const isPinned = pins.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-row-idx={idx}
                    className={`raycast-row no-cursor-lock ${isSelected ? "is-selected" : ""}`}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => {
                      item.onPrimary();
                      onClose();
                    }}
                  >
                    <span className="raycast-row-icon">
                      {iconForCategory(item.category)}
                    </span>
                    <span className="raycast-row-main">
                      <strong>{item.title}</strong>
                      <small>{item.subtitle}</small>
                    </span>
                    <span className="raycast-row-right">
                      {isPinned && (
                        <span className="raycast-pin-tag">PINNED</span>
                      )}
                      {item.badge && (
                        <span className="raycast-badge">{item.badge}</span>
                      )}
                      {item.rightMeta && (
                        <span className="raycast-meta mono">
                          {item.rightMeta}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}

          {orderedItems.length === 0 && (
            <div className="raycast-empty">
              No matching pages, alphas, or BRAIN fields for “{query}”.
            </div>
          )}
        </div>

        {subMenuOpen && activeItem && (
          <div className="raycast-subpalette" role="menu">
            <div className="raycast-subpalette-head">
              <span>Actions for {activeItem.title}</span>
              <kbd>ESC</kbd>
            </div>
            {subActions.map((act, i) => (
              <button
                key={act.label}
                type="button"
                className={`raycast-subpalette-item no-cursor-lock ${i === subMenuIndex ? "is-active" : ""}`}
                onMouseEnter={() => setSubMenuIndex(i)}
                onClick={act.run}
              >
                <span>{act.label}</span>
                <kbd>{act.shortcut}</kbd>
              </button>
            ))}
          </div>
        )}

        <footer className="raycast-footer">
          <div className="raycast-footer-brand">
            <span>
              {orderedItems.length} results ·{" "}
              {loadingFields ? "Searching 4,367 fields…" : "Ready"}
            </span>
          </div>

          <div className="raycast-footer-actions">
            {activeItem && (
              <button
                type="button"
                className="raycast-footer-btn primary"
                onClick={() => {
                  activeItem.onPrimary();
                  onClose();
                }}
              >
                <span>{activeItem.primaryLabel}</span>
                <kbd>↵</kbd>
              </button>
            )}
            <button
              type="button"
              className={`raycast-footer-btn ${subMenuOpen ? "is-open" : ""}`}
              onClick={() => setSubMenuOpen((prev) => !prev)}
            >
              <span>Actions</span>
              <kbd>⌘K</kbd>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default CommandPalette;
