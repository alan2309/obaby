import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Modal, IconButton, Text } from 'react-native-paper';
import {
  scaleSize,
  scaleFont,
  theme,
  getResponsivePadding,
} from '../utils/constants';

type Props = {
  visible: boolean;
  onDismiss: () => void;
  images: string[];
  initialIndex?: number;
};

const ImageGalleryModal: React.FC<Props> = ({
  visible,
  onDismiss,
  images = [],
  initialIndex = 0,
}) => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  // Use a ref to the FlatList
  const listRef = useRef<FlatList<string> | null>(null);

  // Dynamic index state
  const [index, setIndex] = useState<number>(Math.max(0, Math.min(initialIndex, images.length - 1)));

  //When visible or dimensions change, scroll to the right index/offset
  useEffect(() => {
    if (visible && listRef.current) {
      const offset = index * windowWidth;
      // use scrollToOffset which is safer cross-platform
      requestAnimationFrame(() => {
        try {
          listRef.current?.scrollToOffset({ offset, animated: false });
        } catch (e) {
          // fallback to scrollToIndex if needed
          try {
            listRef.current?.scrollToIndex({ index, animated: false });
          } catch (err) {
            // ignore — prevents crash on web/slow list
            console.warn('scroll error', err);
          }
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, index, windowWidth]);

  useEffect(() => {
    if (visible) {
      setIndex(Math.max(0, Math.min(initialIndex, images.length - 1)));
    }
  }, [initialIndex, visible, images.length]);

  const onScroll = (e: any) => {
    const x = e.nativeEvent.contentOffset.x;
    const newIndex = Math.round(x / windowWidth);
    if (newIndex !== index) setIndex(newIndex);
  };

  const renderItem = ({ item }: { item: string }) => {
    return (
      <View style={[styles.imageWrapper, { width: windowWidth, height: windowHeight * 0.85 }]}> 
        <Image
          source={{ uri: item }}
          style={[styles.image, { width: windowWidth, height: windowHeight * 0.85 }]}
          resizeMode="contain"
          onError={(err) => console.log('Image load error', err)}
        />
      </View>
    );
  };

  const goNext = () => {
    if (index < images.length - 1) {
      const next = index + 1;
      setIndex(next);
      const offset = next * windowWidth;
      listRef.current?.scrollToOffset({ offset, animated: true });
    }
  };

  const goPrev = () => {
    if (index > 0) {
      const prev = index - 1;
      setIndex(prev);
      const offset = prev * windowWidth;
      listRef.current?.scrollToOffset({ offset, animated: true });
    }
  };

  const modalPadding = getResponsivePadding();

  return (
    <Modal
      visible={visible}
      onDismiss={onDismiss}
      contentContainerStyle={[
        styles.modalContainer,
        { width: windowWidth, height: windowHeight, paddingTop: Platform.OS === 'android' ? modalPadding : modalPadding + 20 },
      ]}
      dismissable
    >
      <View style={styles.header} pointerEvents="box-none">
        <IconButton icon="close" onPress={onDismiss} accessibilityLabel="Close gallery" />
        <View style={styles.indexWrap}>
          <Text style={styles.indexText}>{`${index + 1} / ${Math.max(1, images.length)}`}</Text>
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={images}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        renderItem={renderItem}
        initialScrollIndex={index}
        onScroll={onScroll}
        onMomentumScrollEnd={onScroll}
        getItemLayout={(_, i) => ({ length: windowWidth, offset: windowWidth * i, index: i })}
        style={styles.list}
        windowSize={3}
        removeClippedSubviews={true}
      />

      {images.length > 1 && (
        <> 
          <TouchableOpacity style={[styles.leftControl, { top: windowHeight / 2 - 40 }]} onPress={goPrev} disabled={index === 0}>
            <IconButton icon="chevron-left" size={32} onPress={goPrev} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.rightControl, { top: windowHeight / 2 - 40 }]} onPress={goNext} disabled={index === images.length - 1}>
            <IconButton icon="chevron-right" size={32} onPress={goNext} />
          </TouchableOpacity>
        </>
      )}

      <View style={[styles.dotsContainer, { bottom: modalPadding * 1.2 }] } pointerEvents="none">
        {images.map((_, i) => (
          <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    backgroundColor: 'rgba(0,0,0,0.97)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scaleSize(12),
    paddingTop: Platform.OS === 'ios' ? 50 : 0,
  },
  indexWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexText: {
    color: '#fff',
    fontSize: scaleFont(14),
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: scaleSize(12),
    paddingVertical: scaleSize(6),
    borderRadius: scaleSize(20),
  },
  list: {
    flexGrow: 0,
  },
  imageWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    // image sizing handled inline based on window dimensions
  },
  leftControl: {
    position: 'absolute',
    left: 0,
    zIndex: 20,
  },
  rightControl: {
    position: 'absolute',
    right: 0,
    zIndex: 20,
  },
  dotsContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: scaleSize(8),
    height: scaleSize(8),
    borderRadius: scaleSize(8),
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: scaleSize(4),
  },
  dotActive: {
    backgroundColor: '#fff',
    width: scaleSize(10),
    height: scaleSize(10),
  },
});

export default ImageGalleryModal;
