export function validateName(name: string): string | null {
  if (!name.trim()) return 'Name is required';
  if (name.length > 50) return 'Name must be 50 characters or less';
  if (!/^[a-zA-Z\s\-']+$/.test(name)) return 'Name can only contain letters, spaces, and hyphens';
  return null;
}

export function validateTopic(topic: string): string | null {
  if (!topic.trim()) return 'Topic is required';
  if (topic.trim().length < 2) return 'Topic must be at least 2 characters';
  if (topic.length > 200) return 'Topic must be 200 characters or less';
  return null;
}

export function validateForm(fields: {
  name: string;
  topic: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  const nameError = validateName(fields.name);
  if (nameError) errors.name = nameError;
  const topicError = validateTopic(fields.topic);
  if (topicError) errors.topic = topicError;
  return errors;
}
