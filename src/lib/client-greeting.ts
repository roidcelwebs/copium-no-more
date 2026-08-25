/**
 * Client greeting - human, friendly, timezone-aware.
 * Uses local Date to detect user's timezone automatically.
 * Preserves required exact phrase: "Fighting crime? {name}" for 1-5 AM per spec.
 * Greetings are deterministic per day to feel human, not AI-generated, and rotate
 * through a small set of friendly variants.
 */
function pick<T>(items: T[], seed: number): T {
  return items[Math.abs(seed) % items.length];
}

export function getClientGreeting(name: string, date: Date): string {
  const hour = date.getHours();
  const day = date.getDate();

  // 1 AM to 4:59 AM - required funny greeting, exact format preserved
  if (hour >= 1 && hour < 5) {
    return `Fighting crime? ${name}`;
  }

  // Midnight to 1 AM
  if (hour >= 0 && hour < 1) {
    return pick([`Still awake, ${name}?`, `Can't sleep, ${name}?`, `Up late, ${name}?`], day);
  }

  // 5 AM to 6:59 AM - early birds
  if (hour >= 5 && hour < 7) {
    return pick(
      [`Up early, ${name}`, `Early bird, ${name}`, `On the early grind, ${name}`],
      day + hour,
    );
  }

  // 7 AM to 11:59 AM - morning
  if (hour >= 7 && hour < 12) {
    return pick(
      [
        `Good morning, ${name}`,
        `Morning, ${name}`,
        `Rise and shine, ${name}`,
        `Good morning, ${name} — let's get after it`,
      ],
      day,
    );
  }

  // 12 PM to 4:59 PM - afternoon
  if (hour >= 12 && hour < 17) {
    return pick(
      [
        `Good afternoon, ${name}`,
        `Afternoon, ${name}`,
        `Hope your day's going good, ${name}`,
      ],
      day,
    );
  }

  // 5 PM to 8:59 PM - evening
  if (hour >= 17 && hour < 21) {
    return pick(
      [`Good evening, ${name}`, `Evening, ${name}`, `Good evening, ${name} — you made it`],
      day,
    );
  }

  // 9 PM to 11:59 PM - night owls
  return pick(
    [`Still going, ${name}?`, `Burning the midnight oil, ${name}?`, `Still up, ${name}?`],
    day + hour,
  );
}
