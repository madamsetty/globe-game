<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Haptic Feedback Button</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        .button-container {
            position: relative;
            display: inline-block;
        }

        .haptic-button {
            position: relative;
            padding: 16px 32px;
            font-size: 18px;
            font-weight: 600;
            color: black;
            background: white;
            border: none;
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
            overflow: hidden;
            user-select: none;
            outline: none;
            transform: translateY(0);
        }

        .haptic-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 12px 35px rgba(0, 0, 0, 0.2);
            background: #f8f9fa;
        }

        .haptic-button:active {
            transform: translateY(0) scale(0.98);
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
        }

        /* Ripple effect - REMOVED */

        /* Pulse animation - REMOVED */

        /* Vibration effect - REMOVED */

        /* Success state */
        .haptic-button.success {
            background: linear-gradient(145deg, #ef4444, #dc2626);
            color: white;
            transform: scale(1.05);
        }

        .haptic-button.success::after {
            content: '✓';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 20px;
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

        /* Button text */
        .button-text {
            position: relative;
            z-index: 1;
            transition: opacity 0.3s ease;
        }

        .haptic-button.success .button-text {
            opacity: 0;
        }

        /* Demo controls */
        .controls {
            position: absolute;
            top: 50px;
            left: 50%;
            transform: translateX(-50%);
            text-align: center;
            color: white;
        }

        .control-button {
            margin: 5px;
            padding: 10px 16px;
            background: rgba(255, 255, 255, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 8px;
            color: white;
            cursor: pointer;
            font-size: 14px;
            transition: background 0.3s ease;
        }

        .control-button:hover {
            background: rgba(255, 255, 255, 0.3);
        }

        .info {
            position: absolute;
            bottom: 50px;
            left: 50%;
            transform: translateX(-50%);
            text-align: center;
            color: rgba(255, 255, 255, 0.8);
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="controls">
        <h2 style="margin-bottom: 20px;">Haptic Feedback Demo</h2>
        <button class="control-button" onclick="triggerSuccess()">Success State</button>
    </div>

    <div class="button-container">
        <button class="haptic-button" id="mainButton">
            <span class="button-text">Click</span>
        </button>
    </div>

    <div class="info">
        Click the main button or use the controls above to see different haptic feedback effects
    </div>

    <script>
        const button = document.getElementById('mainButton');
        let clickCount = 0;
        
        // Main button click handler
        button.addEventListener('click', function(e) {
            triggerSuccess();
            
            // Try to trigger actual haptic feedback on supported devices
            if (navigator.vibrate) {
                navigator.vibrate(50);
            }
        });

        function triggerSuccess() {
            button.classList.remove('success');
            setTimeout(() => {
                button.classList.add('success');
                setTimeout(() => {
                    button.classList.remove('success');
                    // Change button to selected state after success animation
                    button.style.background = 'linear-gradient(145deg, #ef4444, #dc2626)';
                    button.style.color = 'white';
                }, 1000);
            }, 10);
        }

        // Add touch feedback for mobile devices
        button.addEventListener('touchstart', function() {
            this.style.transform = 'translateY(0) scale(0.98)';
        });

        button.addEventListener('touchend', function() {
            this.style.transform = 'translateY(-2px) scale(1)';
        });
    </script>
</body>
</html>