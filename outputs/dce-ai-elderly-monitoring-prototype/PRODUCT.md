# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React + Vite + Tailwind CSS, explicitly requested for a locally runnable prototype.

## Users

Primary users are study participants, including adults and older adults, comparing two hypothetical AI home-care monitoring configurations. Their immediate job is to understand the implications of each configuration, experience a neutral simulation of the same potential event, and make one long-term adoption choice.

## Product Purpose

This single-page research prototype tests whether a conventional text-based DCE choice task can be made more comprehensible and experiential without ceasing to be a rigorous choice experiment.

## Positioning

The prototype couples a data-driven DCE comparison with a configuration-faithful monitoring simulation: the simulated event is held constant while the information exposure and recipients shown to the participant change strictly with each option.

## Operating Context

The page is the first of a planned 12-task university innovation-and-entrepreneurship research questionnaire. It is run locally, does not collect or submit real data, and contains no login, camera, AI model, backend, or database.

## Capabilities and Constraints

- One A/B DCE task, with the progress label “第1题 / 共12题”.
- The only varying attributes in this task are sharing level and recipient group; monitoring mode is identical and must not imply a difference in accuracy, speed, price, or other attributes.
- Participants can select an option, open its scenario simulation, trigger the scripted event, inspect an option-specific notification, and confirm a non-submitted choice.
- Configurations, attribute definitions, and copy must be controlled through reusable data structures so future tasks can swap values, including a `continuous` monitoring mode.
- A future authorized clip may be placed at `public/videos/fall-demo.mp4`; absence must render a graceful placeholder.

## Brand Commitments

The requested character is a rigorous research questionnaire combined with a modern intelligent-care product interface: low-saturation deep green, grey-green, warm ivory, restrained amber for differences, readable Chinese copy, and no sci-fi control-room aesthetic.

## Evidence on Hand

The user supplied the complete research scenario, DCE definitions, required Chinese copy, interaction sequence, and video path. No reference screenshot or licensed video asset was supplied. All monitoring states, timestamps, and event signals are explicitly illustrative.

## Product Principles

1. Make the DCE decision legible before making it impressive.
2. Keep the same simulated incident and risk signal across alternatives; reveal only the configuration-defined exposure differences.
3. Use informed consent language and label every event as a pre-set simulation.
4. Give older participants generous typography, clear feedback, and touch-friendly controls.
5. Separate reusable experimental data from presentation components.

## Accessibility & Inclusion

The prototype must support keyboard operation, visible focus, Escape-to-close overlays, normal focus traversal, responsive touch controls, readable Chinese typography, and reduced-motion preferences. The simulation should never rely on colour alone to communicate a state.
