
import { Component } from 'preact';
import { JSX } from 'preact/jsx-runtime';

interface Props {
  children: (isCompact: boolean) => JSX.Element;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  storageKey?: string;
}

interface State {
  width: number;
  isCompact: boolean;
}

export class ResizablePanel extends Component<Props, State> {
  private static readonly DEFAULT_WIDTH = 350;
  private static readonly MIN_WIDTH = 60;
  private static readonly MAX_WIDTH = 600;
  private static readonly COMPACT_THRESHOLD = 180;
  private static readonly STORAGE_KEY = 'resizable-panel-width';
  
  private isDragging = false;
  private startX = 0;
  private startWidth = 0;

  constructor(props: Props) {
    super(props);
    const key = props.storageKey || ResizablePanel.STORAGE_KEY;
    const saved = localStorage.getItem(key);
    const width = saved 
      ? parseInt(saved, 10) 
      : (props.defaultWidth || ResizablePanel.DEFAULT_WIDTH);
    const clampedWidth = Math.max(
      props.minWidth || ResizablePanel.MIN_WIDTH,
      Math.min(width, props.maxWidth || ResizablePanel.MAX_WIDTH)
    );
    this.state = {
      width: clampedWidth,
      isCompact: clampedWidth < ResizablePanel.COMPACT_THRESHOLD,
    };
  }

  private handleMouseDown = (e: MouseEvent) => {
    this.isDragging = true;
    this.startX = e.clientX;
    this.startWidth = this.state.width;
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('mouseup', this.handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  private handleMouseMove = (e: MouseEvent) => {
    if (!this.isDragging) return;
    const delta = e.clientX - this.startX;
    const newWidth = Math.max(
      this.props.minWidth || ResizablePanel.MIN_WIDTH,
      Math.min(this.startWidth + delta, this.props.maxWidth || ResizablePanel.MAX_WIDTH)
    );
    const isCompact = newWidth < ResizablePanel.COMPACT_THRESHOLD;
    this.setState({ width: newWidth, isCompact });
  };

  private handleMouseUp = () => {
    if (!this.isDragging) return;
    this.isDragging = false;
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    const key = this.props.storageKey || ResizablePanel.STORAGE_KEY;
    localStorage.setItem(key, String(this.state.width));
  };

  componentWillUnmount() {
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }

  render() {
    const { width, isCompact } = this.state;
    return (
      <div className="flex h-full shrink-0" style={{ width: `${width}px` }}>
        <div className="flex-1 overflow-hidden">
          {this.props.children(isCompact)}
        </div>
        <div
          className="w-4 cursor-col-resize shrink-0 flex items-center justify-center group"
          onMouseDown={this.handleMouseDown}
          title="Arrastra para redimensionar"
        >
          <div className="w-px h-8 bg-gray-600 group-hover:bg-blue-400 transition-colors relative">
            <div className="absolute left-0 top-0 w-px h-full bg-gray-600 group-hover:bg-blue-400 -translate-x-1 transition-colors" />
            <div className="absolute left-0 top-0 w-px h-full bg-gray-600 group-hover:bg-blue-400 translate-x-1 transition-colors" />
          </div>
        </div>
      </div>
    );
  }
}
