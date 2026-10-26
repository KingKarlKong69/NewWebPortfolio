// These are the supplied memories, in natural filename order. Keep the source
// photographs intact; each year forms its own surrounding photo carousel.
const memoryImages = (year, count) => Object.freeze(Array.from(
  { length: count },
  (_, index) => `/memory-folder/${year}-Memory/${year}-memory-(${index + 1}).jpg`,
))

export const JOURNEY_INTRO = 'From learning programming fundamentals at Bulacan State University - Bustos Campus to building full-stack systems, my path has been shaped by research, collaboration, and a drive to create meaningful digital products.'

export const JOURNEY_MEMORIES = Object.freeze([
  Object.freeze({
    year: 2022,
    title: 'The Foundation',
    description: 'First year brought uncertainty and a slow start, with programming fundamentals still taking shape.',
    images: memoryImages(2022, 4),
  }),
  Object.freeze({
    year: 2023,
    title: 'Finding My Ground',
    description: 'Second year marked a shift from struggling with the basics to building confidence and independence.',
    images: memoryImages(2023, 4),
  }),
  Object.freeze({
    year: 2024,
    title: 'Falling for the Web',
    description: 'Third year sparked a passion for web development, turning ideas into something tangible and meaningful.',
    images: memoryImages(2024, 6),
  }),
  Object.freeze({
    year: 2025,
    title: 'From Ideas to Architecture',
    description: 'Fourth year brought a bigger perspective — connecting ideas, understanding systems, and thinking beyond individual tasks.',
    images: memoryImages(2025, 7),
  }),
  Object.freeze({
    year: 2026,
    title: 'Beyond the Code',
    description: 'Graduation marked the beginning of a new chapter, exploring AI-native development and the thinking behind intelligent systems.',
    images: memoryImages(2026, 13),
  }),
])
