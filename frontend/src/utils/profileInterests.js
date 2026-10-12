export function getProfileInterests(profileOrResponse) {
  const preferences = profileOrResponse?.tourist?.preferences || profileOrResponse?.preferences || profileOrResponse;
  const interests = preferences?.interests;
  if (Array.isArray(interests)) return interests.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof interests === 'string') {
    try {
      const parsed = JSON.parse(interests);
      return Array.isArray(parsed)
        ? parsed.map(String).map((item) => item.trim()).filter(Boolean)
        : [];
    } catch {
      return interests.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
}
