import { create } from 'zustand';

interface UIState {
  // Active UI components (only one can be open at a time)
  activeComponent: 'none' | 'chatbox' | 'modelselector' | 'profiledropdown';
  
  // Individual component states
  chatBoxOpen: boolean;
  modelSelectorOpen: boolean;
  profileDropdownOpen: boolean;
  
  // Actions to open components (automatically closes others)
  openChatBox: () => void;
  openModelSelector: () => void;
  openProfileDropdown: () => void;
  
  // Actions to close components
  closeChatBox: () => void;
  closeModelSelector: () => void;
  closeProfileDropdown: () => void;
  closeAll: () => void;
}

export const useUIState = create<UIState>((set) => ({
  // Initial state
  activeComponent: 'none',
  chatBoxOpen: false,
  modelSelectorOpen: false,
  profileDropdownOpen: false,
  
  // Open actions (close others first)
  openChatBox: () => set({
    activeComponent: 'chatbox',
    chatBoxOpen: true,
    modelSelectorOpen: false,
    profileDropdownOpen: false,
  }),
  
  openModelSelector: () => set({
    activeComponent: 'modelselector',
    chatBoxOpen: false,
    modelSelectorOpen: true,
    profileDropdownOpen: false,
  }),
  
  openProfileDropdown: () => set({
    activeComponent: 'profiledropdown',
    chatBoxOpen: false,
    modelSelectorOpen: false,
    profileDropdownOpen: true,
  }),
  
  // Close actions
  closeChatBox: () => set((state) => ({
    activeComponent: state.activeComponent === 'chatbox' ? 'none' : state.activeComponent,
    chatBoxOpen: false,
  })),
  
  closeModelSelector: () => set((state) => ({
    activeComponent: state.activeComponent === 'modelselector' ? 'none' : state.activeComponent,
    modelSelectorOpen: false,
  })),
  
  closeProfileDropdown: () => set((state) => ({
    activeComponent: state.activeComponent === 'profiledropdown' ? 'none' : state.activeComponent,
    profileDropdownOpen: false,
  })),
  
  closeAll: () => set({
    activeComponent: 'none',
    chatBoxOpen: false,
    modelSelectorOpen: false,
    profileDropdownOpen: false,
  }),
}));
