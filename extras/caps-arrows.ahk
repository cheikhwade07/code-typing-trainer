; Caps Lock layer: arrow keys on the home row (AutoHotkey v2, Windows).
; Hold Caps Lock and use:
;   I / J / K / L   Up / Left / Down / Right
;   U / O           Home / End
;   H / ;           Backspace / Delete
; Ctrl and Shift still work on top, because real keys are sent:
;   Ctrl + Caps + J      jump a word left
;   Shift + Caps + L     select to the right
;   Ctrl + Caps + H      delete a word
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
CapsLock & u::Send "{Blind}{Home}"
CapsLock & o::Send "{Blind}{End}"
CapsLock & h::Send "{Blind}{Backspace}"
CapsLock & `;::Send "{Blind}{Delete}"
