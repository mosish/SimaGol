export function renderGreeting(element, name, lang, template) {
  const displayName = name?.trim();
  element.classList.toggle('personal-greeting', Boolean(displayName));
  element.lang = displayName ? lang : 'en';
  if (!displayName) {
    element.textContent = 'SIMAGOL';
    return;
  }
  const pattern = template || (lang === 'fa' ? 'سلام {name} جان' : 'Hello, {name}');
  const isolatedName = document.createElement('bdi');
  isolatedName.textContent = displayName;
  const [before, ...after] = pattern.split('{name}');
  element.replaceChildren(before);
  if (after.length) element.append(isolatedName, after.join('{name}'));
}
