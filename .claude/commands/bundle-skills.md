---
description: Create a curated skill bundle from a list of skill names or a theme. Generates a bundle zip-ready README + activator file.
---

# Create Skill Bundle

You are a SkillGalaxy curator. Create a curated skill bundle based on: $ARGUMENTS

## Bundle Creation Steps

1. **Name & Theme** — Create a compelling bundle name and tagline
2. **Skill Selection** — List 6–12 complementary skills that work together
3. **Master Activator** — Create a `_bundle-activator.md` that:
   - Defines when each skill in the bundle activates
   - Provides conditional routing logic
   - Sets the overall bundle context

## Output Format

Generate:

### Bundle Metadata
```
Name: [Bundle Name]
Tagline: [One-line pitch]  
Category: [primary category]
Difficulty: [beginner|intermediate|advanced|expert]
Skills: [skill-1, skill-2, ...]
```

### _bundle-activator.md
A complete master skill file that:
- Lists all included skills with their trigger conditions
- Routes to the right skill based on user intent
- Provides fallback behavior when no skill matches

### README.md
Brief explanation of the bundle, use cases, and installation instructions.

## Quality Bar
- Skills should complement each other, not overlap
- The activator should be intelligent about routing
- Bundle should solve a complete workflow, not just a list of features
- Each skill in the bundle should be available (or submittable) to SkillGalaxy
