export type WheelCategory = 'compliment' | 'romantic-task' | 'funny-challenge' | 'date-idea' | 'memory-question' | 'sweet-question'
export type SurpriseCard = { category: WheelCategory; text: string }

export const wheelCategories: { id: WheelCategory; label: string; color: string }[] = [
  { id: 'compliment', label: 'A compliment', color: '#d9a3ad' },
  { id: 'romantic-task', label: 'A romantic task', color: '#e7c9b7' },
  { id: 'funny-challenge', label: 'A funny challenge', color: '#c9bad7' },
  { id: 'date-idea', label: 'A date idea', color: '#d8cdb0' },
  { id: 'memory-question', label: 'A memory question', color: '#bdcbbd' },
  { id: 'sweet-question', label: 'A sweet question', color: '#dfb3c1' },
]

export const wheelCards: Record<WheelCategory, string[]> = {
  compliment: ['I love how your mind finds the kind detail in a busy day.', 'Your laugh makes even a small story feel like the best part of my day.', 'You make care feel natural, and that is a rare thing.', 'The way you notice little things makes the world feel softer.', 'I admire how you keep being yourself, even when life is a lot.'],
  'romantic-task': ['Send a voice note with one detail you are looking forward to sharing.', 'Choose a song that feels like the two of you and tell them why.', 'Plan a ten-minute no-phone catch-up for tonight.', 'Write down one little ritual you want to start together.', 'Send a photo of the view you wish you could share in person.'],
  'funny-challenge': ['Explain your relationship like a sports commentator for thirty seconds.', 'Give your person a very official award for a tiny thing they do.', 'Invent a theme song for your next video call and hum the chorus.', 'Describe your person as a very lovable household object.', 'Do your best dramatic reading of your last grocery list.'],
  'date-idea': ['Pick one snack each and have a tiny tasting date on a call.', 'Watch the first ten minutes of the same film, then guess what happens.', 'Take a sunset walk at the same time and trade one photo.', 'Choose a recipe you can both make in your own kitchens.', 'Make a shared playlist with one song for each part of an evening.'],
  'memory-question': ['What little moment with us do you replay when you need a smile?', 'Which place we have been together would you like to visit again slowly?', 'What tiny detail from our early days do you still remember?', 'What ordinary day together turned out better than you expected?', 'What was a moment you felt especially understood by me?'],
  'sweet-question': ['What is something I do that makes a place feel more like home?', 'Which small message from me can change the shape of your day?', 'What is one thing you hope we never get too busy to do?', 'When do you feel most like we are on the same team?', 'What is a kind thing you would like to hear more often?'],
}

export const dailySurprises: SurpriseCard[] = [
  { category: 'sweet-question', text: 'What is one small kindness from your person that you would like to return this week?' },
  { category: 'date-idea', text: 'Make a ten-minute date tonight: one drink, one song, and a story from your day.' },
  { category: 'compliment', text: 'Tell your person one quality you appreciate that has nothing to do with how they look.' },
  { category: 'romantic-task', text: 'Send a photo of one ordinary thing near you that you would show them if they were there.' },
  { category: 'memory-question', text: 'Which shared memory feels especially warm when you think of it today?' },
  { category: 'funny-challenge', text: 'Give your next call a very serious title, like “The Great Snack Summit”.' },
  { category: 'sweet-question', text: 'What is a little ritual you could make yours, even from two different places?' },
  { category: 'date-idea', text: 'Choose a city you both want to visit and plan just the first hour there.' },
  { category: 'romantic-task', text: 'Leave a short voice note for your person to hear when they have a quiet moment.' },
  { category: 'memory-question', text: 'What is the funniest thing that has happened during one of your calls?' },
]

export function chooseWheelCard(random: (max: number) => number) {
  const category = wheelCategories[random(wheelCategories.length)]
  const cards = wheelCards[category.id]
  return { category: category.id, text: cards[random(cards.length)] }
}

export function chooseCard(category: WheelCategory, random: (max: number) => number) {
  const cards = wheelCards[category]
  return cards[random(cards.length)]
}

export function isWheelCategory(value: unknown): value is WheelCategory {
  return typeof value === 'string' && wheelCategories.some((category) => category.id === value)
}
