import React from 'react';
import {StyleSheet, View} from 'react-native';
import {KeplerVideoView, VideoPlayer as VegaPlayer} from '@amazon-devices/react-native-w3cmedia';

/** Direct URL playback uses Vega's managed video view. It owns the surface lifecycle. */
export const VideoPlayer = React.memo(function VideoPlayer({player}: {
  player: VegaPlayer;
}) {
  return <View style={styles.surface} pointerEvents="none">
    <KeplerVideoView
      videoPlayer={player}
      scalingmode="fit"
      showControls={false}
      showCaptions={false}
    />
  </View>;
});

const styles = StyleSheet.create({surface: StyleSheet.absoluteFillObject});
