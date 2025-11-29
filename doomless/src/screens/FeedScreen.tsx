// Feed screen renders one card at a time and routes interactions to the controller hook.
// Adds Tinder-style swiping with edge glow hints and tap-to-expand interactions.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FactCard } from '../components/FactCard';
import { QuizCard } from '../components/QuizCard';
import { useFeedController } from '../hooks/useFeedController';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
// Thresholds scale with the display so swipe effort stays consistent across devices.
const H_THRESHOLD = SCREEN_WIDTH * 0.26;
const V_THRESHOLD = SCREEN_HEIGHT * 0.21;
const CARD_HEIGHT = SCREEN_WIDTH * 1.08;
const EXPANDED_CARD_WIDTH = SCREEN_WIDTH - 24;
const EXPANDED_CARD_HEIGHT = Math.max(SCREEN_HEIGHT - 190, CARD_HEIGHT + 60);
const VELOCITY_TRIGGER = 1.35;

type SwipeDirection = 'left' | 'right' | 'up';

const resolveSwipeDirection = (
  dx: number,
  dy: number,
  vx: number,
  vy: number,
): SwipeDirection | null => {
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  // Horizontal swipes take priority when the drag exceeds the horizontal threshold.
  if (absDx > absDy && absDx > H_THRESHOLD) {
    return dx > 0 ? 'right' : 'left';
  }

  // Allow quick horizontal flicks even if distance is small.
  if (absDx > absDy && Math.abs(vx) > VELOCITY_TRIGGER * 0.9) {
    return vx > 0 ? 'right' : 'left';
  }

  // Upwards skip requires a stronger vertical intent so it does not collide with horizontal moves.
  if ((dy < -V_THRESHOLD && absDy > absDx * 0.7) || vy < -VELOCITY_TRIGGER) {
    return 'up';
  }

  return null;
};

export const FeedScreen: React.FC = () => {
  const {
    currentCard,
    isHydrating,
    quizFeedback,
    likeCurrent,
    dislikeCurrent,
    skipCurrent,
    answerQuiz,
    skipQuiz,
  } = useFeedController();

  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const isAnimating = useRef(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Rotate around Z as the horizontal translate value grows, mimicking a physical card hinge.
  const rotation = useMemo(
    () =>
      translateX.interpolate({
        inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
        outputRange: ['-12deg', '0deg', '12deg'],
        extrapolate: 'clamp',
      }),
    [translateX],
  );

  // Edge overlays fade in proportionally to drag distance to provide directional hints.
  const rightHintOpacity = useMemo(
    () =>
      translateX.interpolate({
        inputRange: [0, H_THRESHOLD],
        outputRange: [0, 0.75],
        extrapolate: 'clamp',
      }),
    [translateX],
  );

  const leftHintOpacity = useMemo(
    () =>
      translateX.interpolate({
        inputRange: [-H_THRESHOLD, 0],
        outputRange: [0.75, 0],
        extrapolate: 'clamp',
      }),
    [translateX],
  );

  const topHintOpacity = useMemo(
    () =>
      translateY.interpolate({
        inputRange: [-V_THRESHOLD, 0],
        outputRange: [0.75, 0],
        extrapolate: 'clamp',
      }),
    [translateY],
  );

  const overlayOpacity = useMemo(
    () =>
      scale.interpolate({
        inputRange: [1, 1.05],
        outputRange: [0, 1],
        extrapolate: 'clamp',
      }),
    [scale],
  );

  const resetCardPosition = useCallback(() => {
    Animated.parallel([
      Animated.spring(translateX, {
        toValue: 0,
        bounciness: 14,
        speed: 16,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        bounciness: 14,
        speed: 16,
        useNativeDriver: true,
      }),
    ]).start();
  }, [translateX, translateY]);

  const handleSwipeComplete = useCallback(
    (direction: SwipeDirection, dx: number, dy: number) => {
      if (!currentCard || currentCard.type !== 'fact') {
        resetCardPosition();
        return;
      }

      isAnimating.current = true;

      const targetX =
        direction === 'right'
          ? SCREEN_WIDTH * 1.2
          : direction === 'left'
          ? -SCREEN_WIDTH * 1.2
          : dx;
      const targetY = direction === 'up' ? -SCREEN_HEIGHT * 1.2 : dy;

      Animated.parallel([
        Animated.timing(translateX, {
          toValue: targetX,
          duration: 240,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: targetY,
          duration: 240,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(() => {
        translateX.setValue(0);
        translateY.setValue(0);
        scale.setValue(1);
        isAnimating.current = false;
        setIsExpanded(false);

        if (direction === 'right') {
          likeCurrent();
        } else if (direction === 'left') {
          dislikeCurrent();
        } else {
          skipCurrent();
        }
      });
    },
    [currentCard, dislikeCurrent, likeCurrent, resetCardPosition, scale, skipCurrent, translateX, translateY],
  );

  const canSwipe = currentCard?.type === 'fact' && !isExpanded && !isHydrating;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          if (!canSwipe || isAnimating.current) {
            return false;
          }
          return Math.abs(gestureState.dx) > 6 || Math.abs(gestureState.dy) > 6;
        },
        onPanResponderMove: (_, gestureState) => {
          translateX.setValue(gestureState.dx);
          translateY.setValue(gestureState.dy);
        },
        onPanResponderRelease: (_, gestureState) => {
          if (!canSwipe) {
            resetCardPosition();
            return;
          }

          const direction = resolveSwipeDirection(
            gestureState.dx,
            gestureState.dy,
            gestureState.vx,
            gestureState.vy,
          );

          if (direction) {
            handleSwipeComplete(direction, gestureState.dx, gestureState.dy);
          } else {
            resetCardPosition();
          }
        },
        onPanResponderTerminate: () => {
          resetCardPosition();
        },
      }),
    [canSwipe, handleSwipeComplete, resetCardPosition, translateX, translateY],
  );

  useEffect(() => {
    // Reset transforms whenever a new card appears so it snaps to center.
    translateX.setValue(0);
    translateY.setValue(0);
    scale.setValue(1);
    setIsExpanded(false);
  }, [currentCard?.id, scale, translateX, translateY]);

  const handleExpand = useCallback(() => {
    if (!currentCard || currentCard.type !== 'fact' || isExpanded || isAnimating.current) {
      return;
    }
    setIsExpanded(true);
    Animated.spring(scale, {
      toValue: 1.05,
      friction: 8,
      tension: 90,
      useNativeDriver: true,
    }).start();
  }, [currentCard, isExpanded, scale]);

  const handleCollapse = useCallback(() => {
    if (!isExpanded) {
      return;
    }
    setIsExpanded(false);
    Animated.spring(scale, {
      toValue: 1,
      friction: 8,
      tension: 90,
      useNativeDriver: true,
    }).start();
  }, [isExpanded, scale]);

  const compactCardStyle = useMemo(
    () => ({
      transform: [{ translateX }, { translateY }, { rotate: rotation }, { scale }],
    }),
    [rotation, scale, translateX, translateY],
  );

  const expandedCardStyle = useMemo(
    () => ({
      transform: [{ scale }],
    }),
    [scale],
  );

  const panHandlers = currentCard?.type === 'fact' && !isExpanded ? panResponder.panHandlers : null;

  if (isHydrating) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.placeholder}>
          <ActivityIndicator size="large" />
          <Text style={styles.placeholderText}>Warming up your curiosity...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!currentCard) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.placeholder}>
          <Text style={styles.placeholderTitle}>All caught up!</Text>
          <Text style={styles.placeholderText}>
            You have explored all bundled cards. New content will arrive with the next update.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const isFactCard = currentCard.type === 'fact';
  const showSwipeStack = !(isFactCard && isExpanded);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.heroTitle}>CurioSwipe</Text>
        <Text style={styles.subtitle}>Replace doomscrolling with delightful micro-knowledge.</Text>

        <View style={styles.cardStage}>
          {showSwipeStack && (
            <>
              <Animated.View
                pointerEvents="none"
                style={[styles.overlayDim, { opacity: overlayOpacity }]}
              />
              <Animated.View
                pointerEvents="none"
                style={[styles.edgeHint, styles.edgeHintLeft, { opacity: leftHintOpacity }]}
              />
              <Animated.View
                pointerEvents="none"
                style={[styles.edgeHint, styles.edgeHintRight, { opacity: rightHintOpacity }]}
              />
              <Animated.View
                pointerEvents="none"
                style={[styles.edgeHint, styles.edgeHintTop, { opacity: topHintOpacity }]}
              />

              <Animated.View
                style={[styles.cardContainer, compactCardStyle]}
                {...(panHandlers ?? {})}
              >
                {isFactCard ? (
                  <FactCard
                    card={currentCard}
                    isExpanded={isExpanded}
                    onExpand={handleExpand}
                    onCollapse={handleCollapse}
                  />
                ) : (
                  <QuizCard
                    card={currentCard}
                    feedback={quizFeedback}
                    onSelect={answerQuiz}
                    onSkip={skipQuiz}
                  />
                )}
              </Animated.View>
            </>
          )}
        </View>
      </View>
      {isFactCard && isExpanded && (
        // Full-screen overlay shows the expanded fact card and blocks swiping behind it.
        <View style={styles.expandedOverlay}>
          <Animated.View style={[styles.expandedCardShell, expandedCardStyle]}>
            <FactCard
              card={currentCard}
              isExpanded
              onExpand={handleExpand}
              onCollapse={handleCollapse}
            />
          </Animated.View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  container: {
    flex: 1,
    paddingVertical: 32,
    gap: 20,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#e2e8f0',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    paddingHorizontal: 36,
  },
  cardStage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    borderRadius: 36,
  },
  cardContainer: {
    width: SCREEN_WIDTH * 0.78,
    alignSelf: 'center',
    height: CARD_HEIGHT,
  },
  edgeHint: {
    position: 'absolute',
    borderRadius: 32,
  },
  edgeHintLeft: {
    top: 48,
    bottom: 48,
    left: 16,
    width: 86,
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
  },
  edgeHintRight: {
    top: 48,
    bottom: 48,
    right: 16,
    width: 86,
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
  },
  edgeHintTop: {
    top: 16,
    left: 32,
    right: 32,
    height: 110,
    backgroundColor: 'rgba(250, 204, 21, 0.18)',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 16,
  },
  placeholderTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#e2e8f0',
    textAlign: 'center',
  },
  placeholderText: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
  },
  expandedOverlay: {
    ...StyleSheet.absoluteFillObject,
    paddingTop: 24,
    paddingHorizontal: 12,
    paddingBottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
    zIndex: 20,
    justifyContent: 'center',
  },
  expandedCardShell: {
    justifyContent: 'center',
    alignSelf: 'center',
    paddingHorizontal: 12,
    width: EXPANDED_CARD_WIDTH,
    height: EXPANDED_CARD_HEIGHT,
  },
});
