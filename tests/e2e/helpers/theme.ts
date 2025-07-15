/**
 * Helper method to check if user can click on theme button and toggle theme color
 */
export const canSwitchTheme = async () => {
  const LIGHT_THEME_CLASS = 'bg-slate-50';
  const DARK_THEME_CLASS = 'bg-gray-800';

  const app = await $('.App').getElement();
  // Ищем по классу, а не по тексту
  const toggleThemeButton = await $('.theme-toggle-btn').getElement();

  await expect(app).toBeExisting();
  await expect(toggleThemeButton).toBeExisting();

  const appClasses = await app.getAttribute('class');
  const initialThemeClass = appClasses.includes(LIGHT_THEME_CLASS) ? LIGHT_THEME_CLASS : DARK_THEME_CLASS;
  const afterClickThemeClass = appClasses.includes(LIGHT_THEME_CLASS) ? DARK_THEME_CLASS : LIGHT_THEME_CLASS;

  // Toggle theme
  await toggleThemeButton.click();
  await expect(app).toHaveElementClass(afterClickThemeClass);

  // Toggle back to initial theme
  await toggleThemeButton.click();
  await expect(app).toHaveElementClass(initialThemeClass);
};
