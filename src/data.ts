import type { Route } from './types'

const routeImage = (name: string) => `${import.meta.env.BASE_URL}routes/${name}.webp`
const realRouteImage = (grade: number) => `${import.meta.env.BASE_URL}routes/real-study-v${grade}.jpg`

const gradeStyles = {
  V1: { colorName: 'Mixed', accent: '#356a9a', image: realRouteImage(1) },
  V2: { colorName: 'Mixed', accent: '#c4942d', image: realRouteImage(2) },
  V3: { colorName: 'Mixed', accent: '#d35f45', image: realRouteImage(3) },
  V4: { colorName: 'Mixed', accent: '#52715f', image: realRouteImage(4) },
  V5: { colorName: 'Mixed', accent: '#765a8f', image: realRouteImage(5) },
  V6: { colorName: 'Mixed', accent: '#9a5a3d', image: realRouteImage(6) }
} as const

const featured: Route[] = [
  {
    id: 'feet-first', title: 'Feet First', image: realRouteImage(1), grade: 'V1 study', colorName: 'Mixed holds', accent: '#356a9a',
    notes: 'Real gym photography. V1 is a BETA study level, not the original gym grade.',
    insight: 'Climbers tend to focus too much on hands.',
    hints: [
      'Pay attention to your feet between the two large blue holds.',
      'A higher foot can make the next reach feel much shorter.',
      'Could a quiet high-step help here?',
      'Try RF on the small foothold, stand through the right leg, then RH to the upper blue hold.'
    ]
  },
  {
    id: 'weight-shift', title: 'Weight Shift', image: realRouteImage(3), grade: 'V3 study', colorName: 'Mixed holds', accent: '#d35f45',
    notes: 'Real gym photography. The next hold is close. The useful position is not.',
    insight: 'Body position matters more than reach.',
    hints: [
      'Notice where your hips are in relation to your left foot.',
      'Move your center of gravity before extending your arm.',
      'Try rotating one hip toward the wall.',
      'Keep LF weighted, turn the left hip in, then reach RH to the coral rail.'
    ]
  },
  {
    id: 'multiple-betas', title: 'Multiple Betas', image: realRouteImage(4), grade: 'V4 study', colorName: 'Mixed holds', accent: '#52715f',
    notes: 'Real gym photography with room for different bodies and different ideas.',
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
    const grade = `V${(i % 6) + 1}` as keyof typeof gradeStyles
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
