/**
 * Smart Element Finder
 * UI element discovery using the DOM and accessibility tree
 */

import { Page } from 'playwright';

/**
 * Represents a single interactive UI element discovered on the page
 */
export interface UIElement {
  type: string;
  text?: string;
  ariaLabel?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  value?: string;
  name?: string;
  href?: string;
  options?: string[];
}

/**
 * Result of an element discovery pass on the current page
 */
export interface ElementDiscovery {
  interactive: UIElement[];
  headings: string[];
  labels: string[];
  title: string;
}

/**
 * SmartElementFinder discovers all interactive elements on a Playwright page
 * using the DOM rather than Playwright locators, so results are always consistent.
 */
export class SmartElementFinder {
  /**
   * Discover all interactive elements on the given page.
   *
   * Runs a single page.evaluate() to collect buttons, inputs, selects, links,
   * headings and labels in one round-trip.
   *
   * @param page - Playwright Page to inspect
   * @returns ElementDiscovery containing all found elements and structural info
   */
  async discoverElements(page: Page): Promise<ElementDiscovery> {
    return await page.evaluate((): ElementDiscovery => {
      const interactiveElements: UIElement[] = [];

      // Find all buttons
      document.querySelectorAll('button, [role="button"]').forEach(el => {
        const element = el as HTMLElement;
        const ariaLabel0 = element.getAttribute('aria-label') || undefined;
        const id0 = element.id || undefined;
        const className0 = element.className || undefined;
        interactiveElements.push({
          type: 'button',
          text: element.innerText || element.textContent || '',
          ...(ariaLabel0 !== undefined ? { ariaLabel: ariaLabel0 } : {}),
          ...(id0 !== undefined ? { id: id0 } : {}),
          ...(className0 !== undefined ? { className: className0 } : {}),
          disabled: (element as HTMLButtonElement).disabled
        });
      });

      // Find all inputs and textareas
      document.querySelectorAll('input, textarea').forEach(el => {
        const element = el as HTMLInputElement | HTMLTextAreaElement;
        const placeholder1 = element.placeholder || undefined;
        const value1 = element.value || undefined;
        const name1 = element.getAttribute('name') || undefined;
        const id1 = element.id || undefined;
        const ariaLabel1 = element.getAttribute('aria-label') || undefined;
        interactiveElements.push({
          type:
            element.tagName.toLowerCase() === 'input'
              ? (element as HTMLInputElement).type || 'text'
              : 'textarea',
          ...(placeholder1 !== undefined ? { placeholder: placeholder1 } : {}),
          ...(value1 !== undefined ? { value: value1 } : {}),
          ...(name1 !== undefined ? { name: name1 } : {}),
          ...(id1 !== undefined ? { id: id1 } : {}),
          ...(ariaLabel1 !== undefined ? { ariaLabel: ariaLabel1 } : {}),
        });
      });

      // Find all selects / dropdowns
      document.querySelectorAll('select').forEach(el => {
        const element = el;
        const name2 = element.name || undefined;
        const id2 = element.id || undefined;
        interactiveElements.push({
          type: 'select',
          ...(name2 !== undefined ? { name: name2 } : {}),
          ...(id2 !== undefined ? { id: id2 } : {}),
          options: Array.from(element.options).map(opt => opt.text)
        });
      });

      // Find all links and tab elements
      document.querySelectorAll('a, [role="tab"]').forEach(el => {
        const element = el as HTMLElement;
        const href3 = (element as HTMLAnchorElement).href || undefined;
        const ariaLabel3 = element.getAttribute('aria-label') || undefined;
        interactiveElements.push({
          type: 'link',
          text: element.innerText || element.textContent || '',
          ...(href3 !== undefined ? { href: href3 } : {}),
          ...(ariaLabel3 !== undefined ? { ariaLabel: ariaLabel3 } : {}),
        });
      });

      const headings = Array.from(
        document.querySelectorAll('h1, h2, h3')
      ).map(h => h.textContent || '');

      const labels = Array.from(
        document.querySelectorAll('label')
      ).map(l => l.textContent || '');

      return {
        interactive: interactiveElements,
        headings,
        labels,
        title: document.title
      };
    });
  }
}
