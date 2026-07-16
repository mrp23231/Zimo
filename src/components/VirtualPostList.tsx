import React, { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { List, useDynamicRowHeight, useListRef, type ListImperativeAPI, type RowComponentProps } from 'react-window';

export type VirtualPostListHandle = {
  scrollToTop: () => void;
};

const VIRTUALIZE_THRESHOLD = 12;
const DEFAULT_ROW_HEIGHT = 440;
const LOAD_MORE_OFFSET = 4;

type VirtualPostListProps<T> = {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  hasMore?: boolean;
  onLoadMore?: () => void;
  className?: string;
  listRef?: Ref<VirtualPostListHandle | null>;
};

type RowProps<T> = {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  rowHeight: ReturnType<typeof useDynamicRowHeight>;
};

function VirtualRow<T>({
  index,
  style,
  items,
  renderItem,
  rowHeight,
}: RowComponentProps<RowProps<T>>) {
  const wrapRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    return rowHeight.observeRowElements([el]);
  }, [index, items[index], rowHeight]);

  const item = items[index];
  if (!item) return null;

  return (
    <div style={style}>
      <div ref={wrapRef} className="pb-6">
        {renderItem(item, index)}
      </div>
    </div>
  );
}

export function VirtualPostList<T>({
  items,
  renderItem,
  hasMore,
  onLoadMore,
  className,
  listRef,
}: VirtualPostListProps<T>) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const internalListRef = useListRef();
  const [viewportHeight, setViewportHeight] = useState(560);
  const dynamicRowHeight = useDynamicRowHeight({
    defaultRowHeight: DEFAULT_ROW_HEIGHT,
    key: items.length,
  });

  useImperativeHandle(listRef, () => ({
    scrollToTop: () => {
      internalListRef.current?.scrollToRow({ index: 0, behavior: 'smooth' });
    },
  }));

  useEffect(() => {
    const measure = () => {
      if (!anchorRef.current) return;
      const top = anchorRef.current.getBoundingClientRect().top;
      const next = Math.max(360, Math.floor(window.innerHeight - top - 88));
      setViewportHeight(next);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  if (items.length < VIRTUALIZE_THRESHOLD) {
    return (
      <div className={className}>
        <div className="space-y-6">
          {items.map((item, index) => (
            <React.Fragment key={index}>{renderItem(item, index)}</React.Fragment>
          ))}
        </div>
      </div>
    );
  }

  const rowProps: RowProps<T> = {
    items,
    renderItem,
    rowHeight: dynamicRowHeight,
  };

  return (
    <div ref={anchorRef} className={className}>
      <List
        listRef={internalListRef as React.Ref<ListImperativeAPI>}
        rowCount={items.length}
        rowHeight={dynamicRowHeight}
        rowComponent={VirtualRow}
        rowProps={rowProps}
        overscanCount={3}
        style={{ height: viewportHeight, width: '100%' }}
        onRowsRendered={(visible) => {
          if (!hasMore || !onLoadMore) return;
          if (visible.stopIndex >= items.length - LOAD_MORE_OFFSET) {
            onLoadMore();
          }
        }}
      />
    </div>
  );
}
