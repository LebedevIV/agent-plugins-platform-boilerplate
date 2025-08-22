import { canSwitchTheme } from '../helpers/theme.js';

describe('Webextension Options Page', () => {
  it('should make options page accessible', async () => {
    const extensionPath = await browser.getExtensionPath();
    const optionsUrl = `${extensionPath}/options/index.html`;

    await browser.url(optionsUrl);

    await expect(browser).toHaveTitle('Options');
    await canSwitchTheme();
  });

  describe('API Keys Management', () => {
    beforeEach(async () => {
      const extensionPath = await browser.getExtensionPath();
      const optionsUrl = `${extensionPath}/options/index.html`;
      await browser.url(optionsUrl);

      // Wait for React to load
      await browser.waitUntil(async () => {
        const settingsTab = await $('[id="settings-tab-button"]');
        return await settingsTab.isDisplayed();
      }, {
        timeout: 10000,
        timeoutMsg: 'Options page did not load properly'
      });
    });

    it('should display API Keys section', async () => {
      // Click on settings tab
      const settingsTab = await $('[id="settings-tab-button"]');
      await settingsTab.click();

      // Wait for settings content to load
      await browser.waitUntil(async () => {
        const settingsSections = await $$('[class*="settings-section"]');
        const sectionsCount = await settingsSections.length;
        if (sectionsCount === 0) return false;
        const aiKeysTitle = await settingsSections[0].$('h3');
        return await aiKeysTitle.isDisplayed();
      }, {
        timeout: 5000,
        timeoutMsg: 'API Keys section did not load'
      });

      // Check if API Keys section is present
      const settingsSections = await $$('[class*="settings-section"]');
      const aiKeysSection = await settingsSections[0].$('h3');
      const aiKeysTitle = await aiKeysSection.getText();
      expect(aiKeysTitle).toContain('AI API Keys');
    });

    it('should display fixed API key inputs', async () => {
      const settingsTab = await $('[id="settings-tab-button"]');
      await settingsTab.click();

      await browser.waitUntil(async () => {
        const fixedKeys = await $$('[class*="ai-key-item fixed-key"]');
        const keysCount = await fixedKeys.length;
        return keysCount > 0;
      }, {
        timeout: 5000,
        timeoutMsg: 'Fixed API key inputs did not load'
      });

      // Check that we have fixed API key inputs
      const fixedKeys = await $$('[class*="ai-key-item fixed-key"]');
      const fixedKeysCount = await fixedKeys.length;
      expect(fixedKeysCount).toBeGreaterThan(0);

      // Check that each fixed key has an input field
      for (const keyElement of fixedKeys) {
        const input = await keyElement.$('input[type="password"]');
        expect(await input.isDisplayed()).toBe(true);
      }
    });

    it('should display custom API keys section', async () => {
      const settingsTab = await $('[id="settings-tab-button"]');
      await settingsTab.click();

      await browser.waitUntil(async () => {
        const customKeysSection = await $('[class*="custom-keys-section"]');
        return await customKeysSection.isDisplayed();
      }, {
        timeout: 5000,
        timeoutMsg: 'Custom API keys section did not load'
      });

      // Check for add new key button
      const addButton = await $('[class*="add-key-btn"]');
      expect(await addButton.isDisplayed()).toBe(true);
    });

    it('should display save and test buttons', async () => {
      const settingsTab = await $('[id="settings-tab-button"]');
      await settingsTab.click();

      await browser.waitUntil(async () => {
        const saveButton = await $('[class*="save-btn"]');
        return await saveButton.isDisplayed();
      }, {
        timeout: 5000,
        timeoutMsg: 'Save button did not load'
      });

      const saveButton = await $('[class*="save-btn"]');
      const testButton = await $('[class*="test-btn"]');

      expect(await saveButton.isDisplayed()).toBe(true);
      expect(await testButton.isDisplayed()).toBe(true);

      expect(await saveButton.getText()).toContain('Save');
      expect(await testButton.getText()).toContain('Test');
    });

    it('should allow adding custom API key', async () => {
      const settingsTab = await $('[id="settings-tab-button"]');
      await settingsTab.click();

      const addButton = await $('[class*="add-key-btn"]');
      await addButton.click();

      // Wait for new custom key input to appear
      await browser.waitUntil(async () => {
        const customKeys = await $$('[class*="ai-key-item custom-key"]');
        const keysCount = await customKeys.length;
        return keysCount > 0;
      }, {
        timeout: 3000,
        timeoutMsg: 'Custom key input did not appear after clicking add button'
      });

      const customKeys = await $$('[class*="ai-key-item custom-key"]');
      const customKeysCount = await customKeys.length;
      expect(customKeysCount).toBeGreaterThan(0);

      // Check that the new custom key has input fields
      const lastCustomKey = customKeys[customKeysCount - 1];
      const nameInput = await lastCustomKey.$('input[type="text"]');
      const keyInput = await lastCustomKey.$('input[type="password"]');

      expect(await nameInput.isDisplayed()).toBe(true);
      expect(await keyInput.isDisplayed()).toBe(true);
    });
  });
});
