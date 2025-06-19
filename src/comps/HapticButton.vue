<!-- For usage see end of file.-->
<template>
  <button
    :class="buttonClasses"
    :disabled="disabled"
    :style="buttonStyles"
    @click="handleClick"
    @touchstart="handleTouchStart"
    @touchend="handleTouchEnd"
    @mousedown="handleMouseDown"
    @mouseup="handleMouseUp"
    @mouseleave="handleMouseLeave"
  >
    <span class="button-text" :class="{ 'text-hidden': showSuccess }">
      <slot></slot>
    </span>
    <span v-if="showSuccess" class="success-icon">✓</span>
  </button>
</template>

<script>
export default {
  name: 'HapticButton',
  props: {
    variant: {
      type: String,
      default: 'default',
      validator: (value) => ['default', 'success', 'danger', 'warning', 'info'].includes(value)
    },
    size: {
      type: String,
      default: 'medium',
      validator: (value) => ['small', 'medium', 'large'].includes(value)
    },
    color: {
      type: String,
      default: null
    },
    disabled: {
      type: Boolean,
      default: false
    },
    hapticFeedback: {
      type: Boolean,
      default: true
    },
    successDuration: {
      type: Number,
      default: 1000
    },
    selected: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      showSuccess: false,
      isPressed: false
    }
  },
  computed: {
    buttonClasses() {
      return [
        'haptic-button',
        `haptic-button--${this.variant}`,
        `haptic-button--${this.size}`,
        {
          'haptic-button--pressed': this.isPressed,
          'haptic-button--success': this.showSuccess || this.selected,
          'haptic-button--disabled': this.disabled
        }
      ]
    },
    buttonStyles() {
      const styles = {}
      if (this.color && !this.disabled) {
        styles.background = this.color
        styles.color = this.getContrastColor(this.color)
      }
      return styles
    }
  },
  methods: {
    handleClick(event) {
      if (this.disabled) return
      
      // Trigger haptic feedback
      if (this.hapticFeedback && navigator.vibrate) {
        navigator.vibrate(50)
      }
      
      // Show success state
      this.triggerSuccess()
      
      // Emit click event
      this.$emit('click', event)
    },
    
    handleTouchStart() {
      if (!this.disabled) {
        this.isPressed = true
      }
    },
    
    handleTouchEnd() {
      this.isPressed = false
    },
    
    handleMouseDown() {
      if (!this.disabled) {
        this.isPressed = true
      }
    },
    
    handleMouseUp() {
      this.isPressed = false
    },
    
    handleMouseLeave() {
      this.isPressed = false
    },
    
    triggerSuccess() {
      this.showSuccess = true
      setTimeout(() => {
        this.showSuccess = false
      }, this.successDuration);
    },
    
    getContrastColor(hexColor) {
      // Remove # if present
      const hex = hexColor.replace('#', '')
      
      // Convert to RGB
      const r = parseInt(hex.substr(0, 2), 16)
      const g = parseInt(hex.substr(2, 2), 16)
      const b = parseInt(hex.substr(4, 2), 16)
      
      // Calculate luminance
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
      
      return luminance > 0.5 ? '#000000' : '#ffffff'
    }
  }
}
</script>

<style scoped>
.haptic-button {
  position: relative;
  border: 2px solid transparent;
  border-radius: 12px;
  cursor: pointer;
  font-weight: 600;
  font-family: inherit;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  user-select: none;
  outline: none;
  transform: translateY(0);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
}

/* Sizes */
.haptic-button--small {
  padding: 8px 16px;
  font-size: 14px;
  border-radius: 8px;
}

.haptic-button--medium {
  padding: 16px 32px;
  font-size: 16px;
}

.haptic-button--large {
  padding: 20px 40px;
  font-size: 18px;
  border-radius: 16px;
}

/* Variants */
.haptic-button--default {
  margin: 5px;
  padding: 10px;
  width: 200px;
  cursor: pointer;
  border: none;
  border-radius: 4px;
  background-color: #da291c;
  color: white;
  font-size: medium;
  font-weight: bold;
  transition: background-color 0.3s ease;
}

.haptic-button--success {
  background: linear-gradient(145deg, #10b981, #059669);
  color: white;
}

.haptic-button--selected {
  background: linear-gradient(145deg, #ef4444, #dc2626);
  color: white;
}

.haptic-button--warning {
  background: linear-gradient(145deg, #f59e0b, #d97706);
  color: white;
}

.haptic-button--info {
  background: linear-gradient(145deg, #3b82f6, #2563eb);
  color: white;
}

/* States */
.haptic-button:hover:not(.haptic-button--disabled) {
  border-color: #f88279;
}

.haptic-button:active:not(.haptic-button--disabled),
.haptic-button--pressed:not(.haptic-button--disabled) {
  transform: translateY(0) scale(0.98);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
}

.haptic-button:hover:not(.haptic-button--disabled) {
  background-color: rgb(1, 59, 1);
  outline: none;
}

.haptic-button:focus:not(.haptic-button--disabled) {
  background-color: green;
  outline: none;
}

.haptic-button--disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
}

/* Success state */
.haptic-button--success {
  transform: scale(1.05);
}

.button-text {
  position: relative;
  z-index: 1;
  transition: opacity 0.3s ease;
}

.text-hidden {
  opacity: 0;
}

.success-icon {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 1.2em;
  opacity: 0;
  animation: checkmark 0.5s ease-in-out forwards;
}

@keyframes checkmark {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0);
  }
  50% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.2);
  }
  100% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}

/* Focus styles for accessibility */
.haptic-button:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}
</style>

<!--
Props:
  variant: 'default' | 'success' | 'danger' | 'warning' | 'info'
  size: 'small' | 'medium' | 'large'
  color: string (hex color)
  disabled: boolean
  hapticFeedback: boolean (default: true)
  successDuration: number (default: 1000ms)

Events:
  @click: Emitted when button is clicked

Slots:
  default: Button content

Usage:
  <haptic-button @click="handleClick">Click Me</haptic-button>
  <haptic-button variant="success">Success</haptic-button>
  <haptic-button variant="danger">Danger</haptic-button>
  <haptic-button variant="warning">Warning</haptic-button>
  <haptic-button variant="info">Info</haptic-button>
  <haptic-button size="small">Small</haptic-button>
  <haptic-button size="medium">Medium</haptic-button>
  <haptic-button size="large">Large</haptic-button>
  <haptic-button color="#ff6b6b">Custom Red</haptic-button>
  <haptic-button color="#4ecdc4">Custom Teal</haptic-button>
  <haptic-button disabled>Disabled</haptic-button>
  <haptic-button :haptic-feedback="false">No Haptic</haptic-button>
  <haptic-button :success-duration="2000">Long Success</haptic-button>
  <haptic-button @click="complexAction">Complex Action</haptic-button>
-->