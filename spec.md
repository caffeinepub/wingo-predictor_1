# WinGo Predictor

## Current State
New project, no existing application files.

## Requested Changes (Diff)

### Add
- WinGo 1-minute game period tracker with auto-incrementing period numbers based on real time
- Countdown timer (60-second real-time countdown to next period)
- BIG/SMALL prediction engine using pattern analysis on recent results
- Recent period results history table (period number, result, BIG/SMALL, color)
- BIG/SMALL analysis with percentage bars (last 20 periods)
- Period tracker mini-timeline strip showing B/S labels
- Color prediction (Red/Green/Violet based on number)
- Confidence level display

### Modify
- N/A

### Remove
- N/A

## Implementation Plan
1. Backend: Store period results history, expose APIs to get periods, submit result, get prediction
2. Frontend: Dark neon dashboard UI with live countdown, prediction card, history table, analysis bars
3. Auto period generation based on real UTC time (period = YYYYMMDD + minute-index)
4. Pattern analysis: look at last N results to predict next BIG/SMALL
5. Color logic: 0=violet+red, 5=violet+green, 1/3/7/9=green, 2/4/6/8=red
