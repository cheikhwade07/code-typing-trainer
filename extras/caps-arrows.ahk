; Caps Lock layer: arrow keys on the home row (AutoHotkey v2, Windows).
; Hold Caps Lock and use:
;   I / J / K / L   Up / Left / Down / Right
;   U / O           jump a word left / right   (same as Ctrl+Left / Ctrl+Right)
;   Y / P           Home / End
;   H / ;           Backspace / Delete
;   N               delete the word to the left (same as Ctrl+Backspace)
; Shift still works on top, because real keys are sent:
;   Shift + Caps + L     select to the right
;   Shift + Caps + O     select a word to the right
; Caps Lock itself no longer toggles capitals.
; Start it with Windows: put a shortcut to this file in shell:startup.
; To stop it: right-click the green H icon in the taskbar tray, then Exit.

#Requires AutoHotkey v2.0
#SingleInstance Force
SetCapsLockState "AlwaysOff"

CapsLock & i::Send "{Blind}{Up}"
CapsLock & j::Send "{Blind}{Left}"
CapsLock & k::Send "{Blind}{Down}"
CapsLock & l::Send "{Blind}{Right}"
CapsLock & u::Send "{Blind}^{Left}"
CapsLock & o::Send "{Blind}^{Right}"
CapsLock & y::Send "{Blind}{Home}"
CapsLock & p::Send "{Blind}{End}"
CapsLock & h::Send "{Blind}{Backspace}"
CapsLock & `;::Send "{Blind}{Delete}"
CapsLock & n::Send "{Blind}^{Backspace}"
