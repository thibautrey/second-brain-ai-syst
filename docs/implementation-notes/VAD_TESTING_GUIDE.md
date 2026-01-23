# Voice Activity Detection Testing Guide

## Overview

This guide helps you test the new Voice Activity Detection (VAD) feature for automatic voice recording stop-on-silence functionality.

## Test Environment

- **URL**: http://localhost:5173
- **Page**: Training → Verification step → "Start Verification Recording"
- **Browser**: Chrome, Firefox, Safari, Edge (all with Web Audio API support)

## Test Cases

### Test 1: Basic Auto-Stop Functionality

**Objective**: Verify that recording automatically stops after the user stops speaking

**Steps**:

1. Navigate to the Training page
2. Complete profile selection and recording steps
3. Reach the Verification step
4. Click "Start Recording" button
5. Speak a verification phrase naturally (e.g., "My voice is my password")
6. Stop speaking and remain silent

**Expected Result**:

- Recording starts immediately when button is clicked
- Audio level bar shows real-time audio activity
- Recording automatically stops ~1.5 seconds after you finish speaking
- No manual stop button click needed
- Audio is automatically processed

**Success Criteria**: ✅ Recording stops within 1-2 seconds of silence

---

### Test 2: Multiple Phrases

**Objective**: Test auto-stop with different phrases and speaking patterns

**Steps**:

1. Click "Start Recording"
2. Speak a short phrase: "Hello"
3. Wait for auto-stop
4. Click "Start Recording" again
5. Speak a longer phrase: "The quick brown fox jumps over the lazy dog"
6. Wait for auto-stop

**Expected Result**:

- Both recordings auto-stop appropriately
- Longer phrases get full recording duration
- Auto-stop timing is consistent

**Success Criteria**: ✅ Both recordings complete successfully

---

### Test 3: Pauses Within Speech

**Objective**: Verify that brief pauses during speech don't trigger early stop

**Steps**:

1. Click "Start Recording"
2. Speak: "My voice" (pause 1 second) "is my password"
3. Wait for auto-stop after final word

**Expected Result**:

- Recording does NOT stop during the 1-second pause
- Recording continues until silence after the complete phrase
- Full phrase is captured

**Success Criteria**: ✅ Complete phrase is recorded without interruption

---

### Test 4: Very Quiet Speech

**Objective**: Test VAD behavior with soft/quiet speaking

**Steps**:

1. Click "Start Recording"
2. Speak very quietly
3. Observe audio level bar
4. Wait for auto-stop

**Expected Result**:

- Audio level bar shows low levels (< 30%)
- Warning message appears: "Volume is low - speak louder..."
- Recording still auto-stops correctly (though may need adjustment)

**Success Criteria**: ✅ Recording completes (may want to speak louder)

---

### Test 5: Background Noise

**Objective**: Test VAD robustness with background noise

**Setup**:

- Have background music or ambient noise playing

**Steps**:

1. Click "Start Recording"
2. Speak clearly over the background noise
3. Stop speaking
4. Wait for auto-stop

**Expected Result**:

- Background noise alone doesn't trigger auto-stop
- Speaking is clearly detected despite noise
- Recording stops when you go silent

**Success Criteria**: ✅ Auto-stop works despite background noise

---

### Test 6: Manual Stop Option

**Objective**: Verify that manual stop still works as fallback

**Steps**:

1. Click "Start Recording"
2. Speak briefly
3. Click "Stop Recording" button manually (instead of waiting for auto-stop)
4. Wait for processing

**Expected Result**:

- Manual stop button is available during recording
- Clicking it stops recording immediately
- Audio is still processed correctly

**Success Criteria**: ✅ Manual stop works as fallback option

---

### Test 7: Cancel Recording

**Objective**: Verify cancel functionality still works

**Steps**:

1. Click "Start Recording"
2. Speak a phrase
3. Click "Cancel" button
4. Confirm cancellation

**Expected Result**:

- Recording is stopped immediately
- Audio is not sent for processing
- Recording control goes back to initial state

**Success Criteria**: ✅ Cancel button works correctly

---

### Test 8: Verification Processing

**Objective**: Verify that auto-stopped recordings are processed correctly

**Steps**:

1. Click "Start Recording"
2. Speak: "My voice is my password"
3. Wait for auto-stop and automatic processing
4. Observe verification result

**Expected Result**:

- After auto-stop, UI shows "Processing audio..."
- Processing completes within 2-5 seconds
- Verification result displays (recognized or not recognized)

**Success Criteria**: ✅ Processing and verification work correctly

---

## Performance Metrics

Track these metrics while testing:

| Metric                              | Target      | Notes                            |
| ----------------------------------- | ----------- | -------------------------------- |
| Time to auto-stop after speech ends | 1-2 seconds | Should be responsive             |
| Recording minimum duration          | ~500ms      | Prevents accidental recordings   |
| Audio level responsiveness          | Real-time   | Should show activity immediately |
| Processing time after auto-stop     | 1-3 seconds | Depends on server                |

---

## Troubleshooting

### Issue: Recording doesn't auto-stop

**Possible Causes**:

- Microphone permission not granted
- Audio level threshold too high
- Background noise overwhelming detection

**Solution**:

- Check browser microphone permissions
- Speak louder or closer to microphone
- Reduce background noise
- Adjust `silenceThreshold` in config (lower = more sensitive)

### Issue: Recording stops too early (cutting off speech)

**Possible Causes**:

- Silence threshold too low (too sensitive)
- Silence duration too short

**Solution**:

- Speak more clearly and continuously
- Increase `silenceThreshold` in config (higher = less sensitive)
- Increase `silenceDuration` in config (longer = waits longer)

### Issue: Audio level bar not showing

**Possible Causes**:

- Recording hasn't started
- Audio context not initialized
- Microphone not active

**Solution**:

- Click "Start Recording" to begin
- Allow microphone access when prompted
- Check browser console for errors

---

## Configuration Adjustment

If tests reveal the VAD is too sensitive or not sensitive enough, adjust in `/src/config/vad-config.ts`:

```typescript
// Make VAD less sensitive (waits longer for silence):
silenceDuration: 2000, // was 1500

// Make VAD more sensitive to speech:
silenceThreshold: 20, // was 25 (lower = more sensitive)

// Require longer minimum recording:
minRecordingDuration: 1000, // was 500
```

---

## Browser Compatibility

| Browser       | Status       | Notes                      |
| ------------- | ------------ | -------------------------- |
| Chrome        | ✅ Supported | Full Web Audio API support |
| Firefox       | ✅ Supported | Full Web Audio API support |
| Safari        | ✅ Supported | May need webkit prefix     |
| Edge          | ✅ Supported | Full Web Audio API support |
| Mobile Chrome | ⚠️ Partial   | May have permission issues |
| Mobile Safari | ⚠️ Partial   | May have permission issues |

---

## Final Sign-Off

Once all test cases pass, the feature is ready for production:

- [ ] Test 1: Basic Auto-Stop - PASSED
- [ ] Test 2: Multiple Phrases - PASSED
- [ ] Test 3: Pauses Within Speech - PASSED
- [ ] Test 4: Very Quiet Speech - PASSED
- [ ] Test 5: Background Noise - PASSED
- [ ] Test 6: Manual Stop Option - PASSED
- [ ] Test 7: Cancel Recording - PASSED
- [ ] Test 8: Verification Processing - PASSED

**Tester Name**: **\*\***\_\_\_\_**\*\***  
**Date**: **\*\***\_\_\_\_**\*\***  
**Notes**: ************\*\*************\_\_\_\_************\*\*************

---

## Performance Optimization Notes

If performance issues are observed:

1. **Audio Analysis Frequency**: Reduce update frequency in `monitorActivity()`
2. **FFT Size**: Adjust `fftSize` in VAD constructor (smaller = faster)
3. **Mobile Optimization**: Use lower frequencies for mobile devices
4. **Battery Optimization**: Reduce frequency bin analysis on mobile

---

## Future Enhancements

- [ ] Add manual sensitivity slider in UI
- [ ] Add ML-based voice activity detection
- [ ] Support for different languages
- [ ] User preference persistence
- [ ] A/B testing for different VAD parameters
- [ ] Analytics on recording patterns
