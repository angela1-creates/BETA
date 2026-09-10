import type { Route } from './types'

const routeImage = (name: string) => `${import.meta.env.BASE_URL}routes/${name}.webp`

const gradeStyles = {
  V1: { colorName: 'Blue', accent: '#356a9a', image: routeImage('library-v1-blue') },
  V2: { colorName: 'Yellow', accent: '#c4942d', image: routeImage('library-v2-yellow') },
  V3: { colorName: 'Coral', accent: '#d35f45', image: routeImage('library-v3-coral') },
  V4: { colorName: 'Sage', accent: '#52715f', image: routeImage('library-v4-sage') },
  V5: { colorName: 'Purple', accent: '#765a8f', image: routeImage('library-v5-purple') }
} as const

const featured: Route[] = [
  {
    id: 'feet-first', title: 'Feet First', image: routeImage('feet-first-v1-blue'), grade: 'V1', colorName: 'Blue', accent: '#356a9a',
    notes: 'A gentle line that rewards looking below the waist.',
    insight: 'Climbers tend to focus too much on hands.',
    hints: [
      'Pay attention to your feet between the two large blue holds.',
      'A higher foot can make the next reach feel much shorter.',
      'Could a quiet high-step help here?',
      'Try RF on the small foothold, stand through the right leg, then RH to the upper blue hold.'
    ]
  },
  {
    id: 'weight-shift', title: 'Weight Shift', image: routeImage('weight-shift-v3-coral'), grade: 'V3', colorName: 'Coral', accent: '#d35f45',
    notes: 'The next hold is close. The useful position is not.',
    insight: 'Body position matters more than reach.',
    hints: [
      'Notice where your hips are in relation to your left foot.',
      'Move your center of gravity before extending your arm.',
      'Try rotating one hip toward the wall.',
      'Keep LF weighted, turn the left hip in, then reach RH to the coral rail.'
    ]
  },
  {
    id: 'multiple-betas', title: 'Multiple Betas', image: routeImage('multiple-betas-v4-sage'), grade: 'V4', colorName: 'Sage', accent: '#52715f',
    notes: 'A route with room for different bodies and different ideas.',
    insight: 'There may be more than one good solution.',
    hints: [
      'Look for two different ways to create balance before the final move.',
      'Your best path may depend on reach and hip position.',
      'Compare a flag with a foot swap.',
      'Option A: RF high and flag left. Option B: swap feet, turn right hip in, then LH to the finish.'
    ]
  }
]

const names = [
  'Quiet Toes', 'Corner Study', 'Open Door', 'Soft Focus', 'Inside Edge',
  'Long Exhale', 'Counterpoint', 'Still Frame', 'Low Traverse', 'Balance Point',
  'Crossing Lines', 'Small Geometry', 'The Pivot', 'Near & Far', 'Sideways',
  'First Look', 'Second Thought', 'Shared Center', 'Footnote', 'Unfold'
]

export const routes: Route[] = [
  ...featured,
  ...names.map((title, i): Route => {
    const grade = `V${(i % 5) + 1}` as keyof typeof gradeStyles
    const style = gradeStyles[grade]

    return {
      id: `route-${i + 4}`,
      title,
      grade,
      ...style,
      notes: ['Read the lower half first.', 'Look for balance before distance.', 'A compact movement study.'][i % 3],
      insight: ['Foot choice shapes the next move.', 'Position can create reach.', 'More than one sequence may work.'][i % 3],
      hints: [
        'Pause and scan the space between the holds.',
        'Consider what needs to feel stable before you move.',
        ['Could a flag help here?', 'Try a deliberate weight shift.', 'Would a foot swap create space?'][i % 3],
        'Set your feet first, bring your hips toward the wall, then move the next hand.'
      ]
    }
  })
]

export const emptyAttempt = () => ({
  predictedBeta: [], actualBeta: [], hintLevelUsed: 0, confidenceBefore: 3, confidenceAfter: 3,
  reflection: { surprised: '', misread: '', noticed: '', hintImpact: '' }
})
