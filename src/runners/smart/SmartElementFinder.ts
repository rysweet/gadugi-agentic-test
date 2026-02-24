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
        interactiveElements.push({
          type: 'button',
          text: element.innerText || element.textContent || '',
          ariaLabel: element.getAttribute('aria-label') || undefined,
          id: element.id || undefined,
          className: element.className || undefined,
          disabled: (element as HTMLButtonElement).disabled
        });
      });

      // Find all inputs and textareas
      document.querySelectorAll('input, textarea').forEach(el => {
        const element = el as HTMLInputElement | HTMLTextAreaElement;
        interactiveElements.push({
          type:
            element.tagName.toLowerCase() === 'input'
              ? (element as HTMLInputElement).type || 'text'
              : 'textarea',
          placeholder: element.placeholder || undefined,
          value: element.value || undefined,
          name: element.getAttribute('name') || undefined,
          id: element.id || undefined,
          ariaLabel: element.getAttribute('aria-label') || undefined
        });
      });

      // Find all selects / dropdowns
      document.querySelectorAll('select').forEach(el => {
        const element = el;
        interactiveElements.push({
          type: 'select',
          name: element.name || undefined,
          id: element.id || undefined,
          options: Array.from(element.options).map(opt => opt.text)
        });
      });

      // Find all links and tab elements
      document.querySelectorAll('a, [role="tab"]').forEach(el => {
        const element = el as HTMLElement;
        interactiveElements.push({
          type: 'link',
          text: element.innerText || element.textContent || '',
          href: (element as HTMLAnchorElement).href || undefined,
          ariaLabel: element.getAttribute('aria-label') || undefined
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
