export type GameType = 'truth-or-dare' | 'would-you-rather' | 'how-well-do-you-know-me' | 'guess-my-answer' | 'complete-the-sentence' | 'this-or-that' | 'emoji-love-challenge' | 'deep-love-questions'
export type GameCategory = 'sweet' | 'playful' | 'thoughtful' | 'silly' | 'long-distance' | 'mixed'
export type AnswerMode = 'turn' | 'both' | 'guess'
export type PromptKind = 'truth' | 'dare' | 'question' | 'choice' | 'sentence' | 'emoji'

export type GamePrompt = { id: string; category: GameCategory; text: string; kind: PromptKind; optionA?: string; optionB?: string }
export type GameDefinition = { id: GameType; name: string; shortName: string; personality: string; description: string; instructions: string; answerMode: AnswerMode }

export const categories: { id: GameCategory; label: string; note: string }[] = [
  { id: 'mixed', label: 'A little of everything', note: 'Let the cards decide' },
  { id: 'sweet', label: 'A little sweet', note: 'Soft words & warm moments' },
  { id: 'playful', label: 'Playful', note: 'Light, curious & flirty' },
  { id: 'thoughtful', label: 'Thoughtful', note: 'The questions beneath the surface' },
  { id: 'silly', label: 'A bit silly', note: 'No serious answers required' },
  { id: 'long-distance', label: 'Long distance', note: 'For love in two places' },
]

export const gameCatalog: GameDefinition[] = [
  { id: 'truth-or-dare', name: 'Truth or Dare', shortName: 'Truth or Dare', personality: 'a little daring', description: 'Honest little questions and gentle, good-natured dares.', instructions: 'Take turns. Each card is a truth or a gentle dare for the person whose turn it is. You can always skip anything that does not feel right.', answerMode: 'turn' },
  { id: 'would-you-rather', name: 'Would You Rather', shortName: 'Rather', personality: 'quick & curious', description: 'Two lovely possibilities. Pick one without overthinking it.', instructions: 'Choose A or B on your own. Your answers stay private until you have both picked, then compare and tell each other why.', answerMode: 'both' },
  { id: 'how-well-do-you-know-me', name: 'How Well Do You Know Me?', shortName: 'Know Me', personality: 'a little revealing', description: 'One of you answers for real; the other tries to know them by heart.', instructions: 'The person named as “answerer” writes their real answer. The other person makes a guess. Both answers reveal only after both have submitted. The roles switch next round.', answerMode: 'guess' },
  { id: 'guess-my-answer', name: 'Guess My Answer', shortName: 'Guess Me', personality: 'a tiny mind-read', description: 'Make a guess about what your person would choose, then see.', instructions: 'The answerer shares their own answer while the other person predicts it. You each submit privately; answers reveal when both are in. The answerer changes each round.', answerMode: 'guess' },
  { id: 'complete-the-sentence', name: 'Complete the Sentence', shortName: 'Finish it', personality: 'a shared story', description: 'Finish the same little sentence in your own way.', instructions: 'Complete the sentence independently. Neither answer is shown until both of you are ready. Then read your two endings together.', answerMode: 'both' },
  { id: 'this-or-that', name: 'This or That', shortName: 'This or That', personality: 'fast & instinctive', description: 'Two good things. Choose the one that feels more like you.', instructions: 'Pick one of the two choices on your own. Your choices are revealed together after both people answer.', answerMode: 'both' },
  { id: 'emoji-love-challenge', name: 'Emoji Love Challenge', shortName: 'Emoji Love', personality: 'small pictures, big feelings', description: 'Say a whole little thing with a handful of symbols.', instructions: 'Use up to five emoji to answer the challenge. Your response stays hidden until your person submits theirs too.', answerMode: 'both' },
  { id: 'deep-love-questions', name: 'Deep Love Questions', shortName: 'Deep Questions', personality: 'slow & meaningful', description: 'Room for the things you do not always get around to asking.', instructions: 'Take your time and answer for yourself. Both responses reveal together, so there is no need to rush or match each other.', answerMode: 'both' },
]

const promptRows: GamePrompt[] = [
  // Truth or Dare
  {id:'tod-sw-01',category:'sweet',kind:'truth',text:'What is one small thing your person does that makes an ordinary day better?'}, {id:'tod-sw-02',category:'sweet',kind:'dare',text:'Send your person a voice note saying one thing you appreciate about them.'},
  {id:'tod-pl-01',category:'playful',kind:'truth',text:'What was your first “oh, I like them” moment?'}, {id:'tod-pl-02',category:'playful',kind:'dare',text:'Give your person a new nickname and explain the very specific reason.'},
  {id:'tod-th-01',category:'thoughtful',kind:'truth',text:'What helps you feel most understood when you have had a hard day?'}, {id:'tod-th-02',category:'thoughtful',kind:'dare',text:'Tell your person one question you have been meaning to ask them.'},
  {id:'tod-si-01',category:'silly',kind:'truth',text:'What is the most unserious hill you would defend forever?'}, {id:'tod-si-02',category:'silly',kind:'dare',text:'Describe your relationship as a weather forecast, with sound effects.'},
  {id:'tod-ld-01',category:'long-distance',kind:'truth',text:'What do you most want to do in the first hour of your next visit?'}, {id:'tod-ld-02',category:'long-distance',kind:'dare',text:'Show your person one object near you that you wish they could see in person.'},
  // Would You Rather
  {id:'wyr-sw-01',category:'sweet',kind:'choice',text:'Choose your kind of togetherness.',optionA:'A slow morning with nowhere to be',optionB:'A late-night walk with nowhere to go'}, {id:'wyr-sw-02',category:'sweet',kind:'choice',text:'Pick a little love ritual.',optionA:'A good-morning voice note',optionB:'A handwritten note in your bag'},
  {id:'wyr-pl-01',category:'playful',kind:'choice',text:'Your date night has a theme.',optionA:'Cook something new together',optionB:'Try a game neither of you knows'}, {id:'wyr-pl-02',category:'playful',kind:'choice',text:'A spontaneous afternoon together.',optionA:'Get pleasantly lost in a new place',optionB:'Stay in and make up a ridiculous contest'},
  {id:'wyr-th-01',category:'thoughtful',kind:'choice',text:'Which would you rather make more room for?',optionA:'Long conversations about everything',optionB:'Comfortable quiet with no need to fill it'}, {id:'wyr-th-02',category:'thoughtful',kind:'choice',text:'Which shared gift sounds more like you?',optionA:'A new skill you learn together',optionB:'A tradition you keep for years'},
  {id:'wyr-si-01',category:'silly',kind:'choice',text:'Pick your very important household role.',optionA:'Official snack quality inspector',optionB:'Chief blanket arrangement officer'}, {id:'wyr-si-02',category:'silly',kind:'choice',text:'A friendly competition begins.',optionA:'Who can make the worst pun',optionB:'Who can do the most dramatic reading'},
  {id:'wyr-ld-01',category:'long-distance',kind:'choice',text:'Make a long-distance evening feel close.',optionA:'Watch the same film on a call',optionB:'Order each other a surprise dessert'}, {id:'wyr-ld-02',category:'long-distance',kind:'choice',text:'A little window into your day.',optionA:'Trade one photo every evening',optionB:'Send a short voice note on your way home'},
  // How Well Do You Know Me?
  {id:'know-sw-01',category:'sweet',kind:'question',text:'What compliment from you would make me feel especially seen?'}, {id:'know-sw-02',category:'sweet',kind:'question',text:'What kind of small surprise makes me happiest?'},
  {id:'know-pl-01',category:'playful',kind:'question',text:'If I had a completely free Saturday, how would I spend it?'}, {id:'know-pl-02',category:'playful',kind:'question',text:'What silly thing can always get me laughing?'},
  {id:'know-th-01',category:'thoughtful',kind:'question',text:'When I am stressed, what kind of support do I usually want first?'}, {id:'know-th-02',category:'thoughtful',kind:'question',text:'What is something I feel proud of but do not say often?'},
  {id:'know-si-01',category:'silly',kind:'question',text:'If I were a kitchen appliance, which one would I be and why?'}, {id:'know-si-02',category:'silly',kind:'question',text:'What is my most predictable order at a favourite café?'},
  {id:'know-ld-01',category:'long-distance',kind:'question',text:'What do I miss most about our everyday time together?'}, {id:'know-ld-02',category:'long-distance',kind:'question',text:'What would I put first on our next visit itinerary?'},
  // Guess My Answer
  {id:'guess-sw-01',category:'sweet',kind:'question',text:'Which little gesture from you makes me feel closest to you?'}, {id:'guess-sw-02',category:'sweet',kind:'question',text:'What is my favourite way to spend an unplanned hour with you?'},
  {id:'guess-pl-01',category:'playful',kind:'question',text:'If we could borrow a silly talent as a couple, what would I pick?'}, {id:'guess-pl-02',category:'playful',kind:'question',text:'Which made-up couple holiday would I celebrate first?'},
  {id:'guess-th-01',category:'thoughtful',kind:'question',text:'What is one dream I want us to make time for?'}, {id:'guess-th-02',category:'thoughtful',kind:'question',text:'What kind of reassurance feels most meaningful to me?'},
  {id:'guess-si-01',category:'silly',kind:'question',text:'If I had to give a five-minute speech with no prep, what would it be about?'}, {id:'guess-si-02',category:'silly',kind:'question',text:'Which animal do I think has the most relatable personality?'},
  {id:'guess-ld-01',category:'long-distance',kind:'question',text:'What time of day do I most wish we were in the same place?'}, {id:'guess-ld-02',category:'long-distance',kind:'question',text:'What is the first meal I would want us to share when we meet?'},
  // Complete the Sentence
  {id:'sentence-sw-01',category:'sweet',kind:'sentence',text:'I feel most loved by you when…'}, {id:'sentence-sw-02',category:'sweet',kind:'sentence',text:'A little thing I hope we always keep doing is…'},
  {id:'sentence-pl-01',category:'playful',kind:'sentence',text:'Our ideal completely unserious date would include…'}, {id:'sentence-pl-02',category:'playful',kind:'sentence',text:'If our relationship had a mascot, it would be…'},
  {id:'sentence-th-01',category:'thoughtful',kind:'sentence',text:'One thing I am learning about love is…'}, {id:'sentence-th-02',category:'thoughtful',kind:'sentence',text:'I feel brave enough to be myself with you because…'},
  {id:'sentence-si-01',category:'silly',kind:'sentence',text:'We would win a very niche award for…'}, {id:'sentence-si-02',category:'silly',kind:'sentence',text:'Our imaginary reality show would be called…'},
  {id:'sentence-ld-01',category:'long-distance',kind:'sentence',text:'When we are apart, a little thing that brings you close is…'}, {id:'sentence-ld-02',category:'long-distance',kind:'sentence',text:'The first thing I want to do together next time is…'},
  // This or That
  {id:'tat-sw-01',category:'sweet',kind:'choice',text:'Choose your softer evening.',optionA:'A long hug after a long day',optionB:'A long talk after a long day'}, {id:'tat-sw-02',category:'sweet',kind:'choice',text:'Pick your kind of keepsake.',optionA:'A note written just for you',optionB:'A photo from an ordinary day'},
  {id:'tat-pl-01',category:'playful',kind:'choice',text:'Pick tonight’s mini adventure.',optionA:'Try a new recipe together',optionB:'Invent a new game together'}, {id:'tat-pl-02',category:'playful',kind:'choice',text:'Choose the better couple superpower.',optionA:'Always find the best snacks',optionB:'Always pick the perfect song'},
  {id:'tat-th-01',category:'thoughtful',kind:'choice',text:'Which would you rather hear more often?',optionA:'“I’m proud of you.”',optionB:'“I’m right here.”'}, {id:'tat-th-02',category:'thoughtful',kind:'choice',text:'What makes a home feel more like home?',optionA:'A familiar routine',optionB:'Someone who listens'},
  {id:'tat-si-01',category:'silly',kind:'choice',text:'An important debate.',optionA:'Pancakes for dinner',optionB:'Breakfast for dinner'}, {id:'tat-si-02',category:'silly',kind:'choice',text:'Your couple mascot has to be…',optionA:'A very confident pigeon',optionB:'A sleepy little otter'},
  {id:'tat-ld-01',category:'long-distance',kind:'choice',text:'Pick your next small connection ritual.',optionA:'A photo of the sky each day',optionB:'A song for the week each Sunday'}, {id:'tat-ld-02',category:'long-distance',kind:'choice',text:'Which would make a visit feel extra special?',optionA:'Revisit a familiar favourite place',optionB:'Explore somewhere neither of you knows'},
  // Emoji Love Challenge
  {id:'emoji-sw-01',category:'sweet',kind:'emoji',text:'Describe how your person makes you feel using three emoji.'}, {id:'emoji-sw-02',category:'sweet',kind:'emoji',text:'Send a tiny emoji thank-you for one thing they do.'},
  {id:'emoji-pl-01',category:'playful',kind:'emoji',text:'Pitch your dream date using five emoji or fewer.'}, {id:'emoji-pl-02',category:'playful',kind:'emoji',text:'Create a secret emoji code for “come talk to me”.'},
  {id:'emoji-th-01',category:'thoughtful',kind:'emoji',text:'Use emoji to show what a safe place feels like to you.'}, {id:'emoji-th-02',category:'thoughtful',kind:'emoji',text:'Draw the kind of future you hope to build together in emoji.'},
  {id:'emoji-si-01',category:'silly',kind:'emoji',text:'Tell the story of your last snack using only emoji.'}, {id:'emoji-si-02',category:'silly',kind:'emoji',text:'Make your person guess your current mood with three emoji.'},
  {id:'emoji-ld-01',category:'long-distance',kind:'emoji',text:'Show what you wish you could do together right now.'}, {id:'emoji-ld-02',category:'long-distance',kind:'emoji',text:'Send an emoji postcard from where you are today.'},
  // Deep Love Questions
  {id:'deep-sw-01',category:'sweet',kind:'question',text:'When have you felt especially cared for by me?'}, {id:'deep-sw-02',category:'sweet',kind:'question',text:'What part of our story do you hope we keep telling?'},
  {id:'deep-pl-01',category:'playful',kind:'question',text:'What new thing would you like us to be beginners at together?'}, {id:'deep-pl-02',category:'playful',kind:'question',text:'If we had a whole day with no plans, what might make it memorable?'},
  {id:'deep-th-01',category:'thoughtful',kind:'question',text:'What does feeling supported look like for you when things are uncertain?'}, {id:'deep-th-02',category:'thoughtful',kind:'question',text:'What is one way you have changed since we met that you feel good about?'},
  {id:'deep-si-01',category:'silly',kind:'question',text:'Which tiny, ridiculous thing should become a tradition just for us?'}, {id:'deep-si-02',category:'silly',kind:'question',text:'If we wrote a book about us, what would the very silly chapter title be?'},
  {id:'deep-ld-01',category:'long-distance',kind:'question',text:'What helps you feel connected when our days do not overlap much?'}, {id:'deep-ld-02',category:'long-distance',kind:'question',text:'What is one part of ordinary life you look forward to sharing in person?'},
]

const prefixByGame: Record<GameType, string> = {
  'truth-or-dare': 'tod-', 'would-you-rather': 'wyr-', 'how-well-do-you-know-me': 'know-', 'guess-my-answer': 'guess-',
  'complete-the-sentence': 'sentence-', 'this-or-that': 'tat-', 'emoji-love-challenge': 'emoji-', 'deep-love-questions': 'deep-',
}
export const promptBank: Record<GameType, GamePrompt[]> = Object.fromEntries(gameCatalog.map(({ id }) => [id, promptRows.filter((prompt) => prompt.id.startsWith(prefixByGame[id]))])) as Record<GameType, GamePrompt[]>

export function isGameType(value: unknown): value is GameType { return typeof value === 'string' && gameCatalog.some((game) => game.id === value) }
export function isCategory(value: unknown): value is GameCategory { return typeof value === 'string' && categories.some((category) => category.id === value) }
export function getGame(value: string) { return gameCatalog.find((game) => game.id === value) }
export function getPrompt(gameType: GameType, id: string) { return promptBank[gameType].find((prompt) => prompt.id === id) }
export function getPrompts(gameType: GameType, category: GameCategory) { return category === 'mixed' ? promptBank[gameType] : promptBank[gameType].filter((prompt) => prompt.category === category) }
