import { expect, test, type Page } from '@playwright/test';

const appearances = ['light', 'dark'] as const;
const accents = [
  'heritage-green',
  'lime',
  'amber',
  'orange',
  'red',
  'rose',
  'magenta',
  'violet',
  'indigo',
  'blue',
  'cyan',
  'teal',
] as const;

function mockAuthenticatedShell(page: Page) {
  page.route('**/api/v1/user', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
      }),
    });
  });
}

test('all appearance and accent combinations meet contrast requirements', async ({ page }) => {
  mockAuthenticatedShell(page);
  await page.goto('/');

  const failures = await page.evaluate(
    ({ testedAppearances, testedAccents }) => {
      function luminance(color: string) {
        const channels = color.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [];
        const normalizedChannels = color.startsWith('color(srgb')
          ? channels.map((channel) => channel * 255)
          : channels;
        const linear = normalizedChannels.map((channel) => {
          const value = channel / 255;
          return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
      }

      function contrast(first: string, second: string) {
        const firstLuminance = luminance(first);
        const secondLuminance = luminance(second);
        return (
          (Math.max(firstLuminance, secondLuminance) + 0.05) /
          (Math.min(firstLuminance, secondLuminance) + 0.05)
        );
      }

      const results: string[] = [];
      const root = document.documentElement;
      const primaryButton = document.createElement('button');
      primaryButton.className = 'btn btn-primary';
      primaryButton.textContent = 'Test';
      document.body.append(primaryButton);
      const focusProbe = document.createElement('span');
      focusProbe.style.outline = '3px solid var(--hap-focus)';
      document.body.append(focusProbe);
      const accentTextProbe = document.createElement('span');
      accentTextProbe.className = 'text-primary';
      const surfaceProbe = document.createElement('div');
      surfaceProbe.style.background = 'var(--hap-surface)';
      surfaceProbe.append(accentTextProbe);
      document.body.append(surfaceProbe);

      for (const appearance of testedAppearances) {
        root.setAttribute('data-bs-theme', appearance);

        for (const accent of testedAccents) {
          root.setAttribute('data-hap-accent', accent);
          const buttonStyles = getComputedStyle(primaryButton);
          const bodyStyles = getComputedStyle(document.body);
          const primary = buttonStyles.backgroundColor;
          const foreground = buttonStyles.color;
          const bodyBackground = bodyStyles.backgroundColor;
          const bodyColor = bodyStyles.color;
          const focusColor = getComputedStyle(focusProbe).outlineColor;
          const accentTextColor = getComputedStyle(accentTextProbe).color;
          const surfaceColor = getComputedStyle(surfaceProbe).backgroundColor;

          const controlRatio = contrast(primary, foreground);
          const bodyRatio = contrast(bodyBackground, bodyColor);
          const focusRatio = contrast(bodyBackground, focusColor);
          const accentTextRatio = contrast(surfaceColor, accentTextColor);

          if (controlRatio < 4.5) {
            results.push(`${appearance}/${accent} control ${controlRatio.toFixed(2)}`);
          }
          if (bodyRatio < 4.5) {
            results.push(`${appearance}/${accent} body ${bodyRatio.toFixed(2)}`);
          }
          if (focusRatio < 3) {
            results.push(`${appearance}/${accent} focus ${focusRatio.toFixed(2)}`);
          }
          if (accentTextRatio < 4.5) {
            results.push(`${appearance}/${accent} accent text ${accentTextRatio.toFixed(2)}`);
          }
        }
      }

      primaryButton.remove();
      focusProbe.remove();
      surfaceProbe.remove();
      return results;
    },
    { testedAppearances: appearances, testedAccents: accents },
  );

  expect(failures).toEqual([]);
});
