export interface PageObserverOptions {
  root?: ParentNode;
  targetSelector?: string;
}

const DEFAULT_TARGET_SELECTOR = "#main";
const PLUGIN_OWNED_SELECTORS = [
  "#ao3th-hover-host",
  "[data-ao3th-toast-container]",
  "[data-ao3th-toast]",
  "[data-ao3th-collapse-placeholder]",
  "[data-ao3th-warn-banner]",
  "[data-ao3th-collapse-match-banner]",
];

let observer: MutationObserver | null = null;

export function startPageObserver(
  onDomChange: () => void,
  options: PageObserverOptions = {}
): void {
  stopPageObserver();

  const target = findObserverTarget(options);
  if (!target) return;

  observer = new MutationObserver((mutations) => {
    const removedPluginNodes = mutations
      .filter((mutation) => isPluginOwned(mutation.target))
      .flatMap((mutation) => Array.from(mutation.removedNodes));
    if (mutations.some((mutation) => isRelevantMutation(mutation, removedPluginNodes))) {
      onDomChange();
    }
  });

  observer.observe(target, {
    childList: true,
    characterData: true,
    subtree: true,
  });
}

export function stopPageObserver(): void {
  observer?.disconnect();
  observer = null;
}

function findObserverTarget(options: PageObserverOptions): Node | null {
  const root = options.root ?? document;
  const selector = options.targetSelector ?? DEFAULT_TARGET_SELECTOR;
  const selected = root.querySelector(selector);
  if (selected) return selected;

  if (root instanceof Document) return root.body;
  if (root instanceof Node) return root;
  return document.body;
}

function isRelevantMutation(mutation: MutationRecord, removedPluginNodes: readonly Node[]): boolean {
  if (isPluginOwned(mutation.target) || removedPluginNodes.some((node) => node.contains(mutation.target))) return false;
  if (mutation.type === "characterData") return true;
  if (mutation.type !== "childList") return false;

  return (
    hasRelevantNodes(mutation.addedNodes) ||
    hasRelevantNodes(mutation.removedNodes)
  );
}

function hasRelevantNodes(nodes: NodeList): boolean {
  return Array.from(nodes).some(
    (node) => (node instanceof Element || node instanceof Text) && !isPluginOwned(node)
  );
}

function isPluginOwned(node: Node): boolean {
  const element = node instanceof Element ? node : node.parentElement;
  return Boolean(element?.closest(PLUGIN_OWNED_SELECTORS.join(",")));
}
