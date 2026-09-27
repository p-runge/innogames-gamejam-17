#!/bin/bash
#
# Build the game's audio assets from the source recordings.
#
# The wav files in public/sounds/ are what the pack shipped: they differ by up to
# 24 LUFS, so playing them at the same gain makes the coins startle and the
# typing inaudible. This script levels every clip to one loudness and encodes it,
# which is what lets the volumes in src/lib/audio/catalogue.ts be a mix decision
# ("ambience sits under the player's own actions") rather than per-file damage
# control.
#
# Run from anywhere:  bash tools/sounds/build.sh
# Requires ffmpeg. Overwrites the mp3 files in public/sounds/.

set -euo pipefail

# Every number here is written and parsed with a decimal point, including the
# ones handed to ffmpeg. Under a locale that uses a comma, printf and bc disagree
# about what "1.9" means and the levels come out silently wrong.
export LC_ALL=C

cd "$(dirname "$0")/../.."
SOUNDS=public/sounds

# Integrated loudness every clip is levelled to, and the true-peak ceiling that
# survives mp3 encoding without clipping. -16 LUFS is the usual web target; the
# mix in the catalogue takes it down from there.
TARGET_I=-16
TARGET_TP=-1.0
TARGET_LRA=11

# Source, output, the slice worth keeping, and anything the clip needs before it
# can be levelled: source|output|from|to|prefilter.
#
# Two of the recordings are much longer than the moment they are used for. They
# are cut here rather than stopped by a timer at playback: cutting a waveform
# mid-flight is a step to zero, which is a click. The slice ends on a fade.
#
#   typing   the recording starts hesitantly and gets denser; 8.4s in is the
#            part that sounds like someone firing off a post. It is also the one
#            clip gain alone cannot lift: isolated keystrokes peak near full
#            scale while averaging 14 dB below every other sound, so it needs a
#            limiter to close the gap. Safe here because the gaps between the
#            strokes are digital silence — there is no noise floor to raise.
#   ovation  six seconds of a crowd is a scene, not a reaction
CLIPS=(
  "aaa_background music.wav|background-music.mp3|||"
  "mixkit-clinking-coins-1993.wav|coins.mp3|||"
  "mixkit-males-yes-victory-2012.wav|victory.mp3|||"
  "mixkit-fighting-man-voice-of-pain-2173.wav|pain.mp3|||"
  "mixkit-hard-typing-1390.wav|typing.mp3|8.4|9.8|alimiter=level_in=30:limit=0.9:attack=1:release=40,"
  "mixkit-male-clearing-the-throat-2226.wav|throat-clear.mp3|||"
  "mixkit-male-falling-scream-392.wav|scream.mp3|||"
  "mixkit-small-crowd-ovation-437.wav|ovation.mp3|0|3.2|"
  "mixkit-tired-man-yawns-2274.wav|yawn.mp3|||"
  "mixkit-man-coughing-2224.wav|cough.mp3|||"
  "mixkit-man-stretching-in-the-morning-2471.wav|stretch.mp3|||"
)

# The loop is the one file that is not levelled by loudnorm.
#
# loudnorm is a dynamic filter, and the background music is the only clip whose
# length has to stay exact to the sample: it is looped, and a filter that trims
# or pads it by a few milliseconds puts a hole in the seam every forty seconds.
# A plain gain cannot change the length. Measured -17.90 LUFS at -5.45 dBTP, so
# +1.9 dB reaches the target with peak room to spare.
MUSIC_SOURCE="aaa_background music.wav"
MUSIC_GAIN_DB=1.9

# Cut before the fade so the fade lands inside the slice, not after it.
FADE_OUT=0.2
FADE_IN=0.05

encode() {
  local filters=$1 output=$2 source=$3
  ffmpeg -nostdin -hide_banner -loglevel error -y \
    -i "$SOUNDS/$source" -af "$filters" \
    -codec:a libmp3lame -b:a 128k -ar 44100 "$SOUNDS/$output"
}

# The slice of a clip, as an ffmpeg filter chain, before any levelling.
slice() {
  local from=$1 to=$2
  [ -z "$from" ] && return 0

  local length fade_at
  length=$(echo "$to - $from" | bc)
  fade_at=$(echo "$length - $FADE_OUT" | bc)
  # atrim leaves the timestamps where they were, which every later filter reads
  # as a clip that begins minutes in; asetpts moves them back to zero.
  printf 'atrim=%s:%s,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=%s,afade=t=out:st=%s:d=%s,' \
    "$from" "$to" "$FADE_IN" "$fade_at" "$FADE_OUT"
}

# Everything loudnorm needs to level in one static gain instead of riding the
# clip's dynamics. Without the measured pass it works blind and pumps.
measure() {
  local filters=$1 source=$2
  ffmpeg -nostdin -hide_banner -i "$SOUNDS/$source" \
    -af "${filters}loudnorm=I=$TARGET_I:TP=$TARGET_TP:LRA=$TARGET_LRA:print_format=json" \
    -f null - 2>&1 | awk '/^\{/,/^\}/'
}

field() {
  printf '%s' "$1" | grep "\"$2\"" | sed 's/.*: "//;s/".*//'
}

for clip in "${CLIPS[@]}"; do
  IFS='|' read -r source output from to prefilter <<<"$clip"

  if [ "$source" = "$MUSIC_SOURCE" ]; then
    encode "volume=${MUSIC_GAIN_DB}dB" "$output" "$source"
    printf '%-22s gain +%s dB (loop, length preserved)\n' "$output" "$MUSIC_GAIN_DB"
    continue
  fi

  cut="$(slice "$from" "$to")${prefilter}"
  json=$(measure "$cut" "$source")

  # linear=true asks for one gain across the clip. ffmpeg falls back to riding
  # the dynamics by itself when the peaks leave no room for it, which is what
  # the sparse keyboard recording needs to reach the target at all.
  encode "${cut}loudnorm=I=$TARGET_I:TP=$TARGET_TP:LRA=$TARGET_LRA:measured_I=$(field "$json" input_i):measured_TP=$(field "$json" input_tp):measured_LRA=$(field "$json" input_lra):measured_thresh=$(field "$json" input_thresh):offset=$(field "$json" target_offset):linear=true" \
    "$output" "$source"

  printf '%-22s %8s LUFS -> %s\n' "$output" "$(field "$json" input_i)" "$TARGET_I"
done
