; Caps Lock layer: arrow keys on the home row (AutoHotkey v2, Windows).
; Hold Caps Lock and use:
;   I / J / K / L   Up / Left / Down / Right
;   U / O           jump a word left / right   (same as Ctrl+Left / Ctrl+Right)
;   Y / P           Home / End
;   H / ;           Backspace / Delete
;   N               delete the word to the left (same as Ctrl+Backspace)
;   , / .           undo / redo   (same as Ctrl+Z / Ctrl+Y)
;   X / C / V       cut / copy / paste
; Select: also hold D (Shift) with any move above, for example
;   Caps + D + O     select a word to the right
;   Caps + D + P     select to the end of the line
; The real Shift key still works on top too (Shift + Caps + O).
; Caps Lock itself no longer toggles capitals.
; Start it with Windows: put a shortcut to this file in shell:startup.
; To stop it: right-click the green H icon in the taskbar tray, then Exit.

#Requires AutoHotkey v2.0
#SingleInstance Force
SetCapsLockState "AlwaysOff"

; A move, as a selection while D is held.
Move(keys) {
    Send (GetKeyState("d", "P") ? "{Blind}+" : "{Blind}") keys
}

CapsLock & d::return ; D is the select modifier inside the layer

CapsLock & i::Move("{Up}")
CapsLock & j::Move("{Left}")
CapsLock & k::Move("{Down}")
CapsLock & l::Move("{Right}")
CapsLock & u::Move("^{Left}")
CapsLock & o::Move("^{Right}")
CapsLock & y::Move("{Home}")
CapsLock & p::Move("{End}")
CapsLock & h::Send "{Blind}{Backspace}"
CapsLock & `;::Send "{Blind}{Delete}"
CapsLock & n::Send "{Blind}^{Backspace}"
CapsLock & ,::Send "{Blind}^z"
CapsLock & .::Send "{Blind}^y"
CapsLock & x::Send "{Blind}^x"
CapsLock & c::Send "{Blind}^c"
CapsLock & v::Send "{Blind}^v"
