Add-Type -AssemblyName System.Windows.Forms

$source = @"
using System;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

public class ClipTyper
{
    [DllImport("user32.dll")]
    static extern short GetAsyncKeyState(int vKey);

    [DllImport("user32.dll", SetLastError = true)]
    static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

    const uint KEYEVENTF_KEYUP = 0x0002;
    const uint KEYEVENTF_UNICODE = 0x0004;
    const uint KEYEVENTF_EXTENDEDKEY = 0x0001;

    const int VK_RBUTTON = 0x02;
    const int VK_ESCAPE = 0x1B;
    const ushort VK_RETURN = 0x0D;
    const ushort VK_TAB = 0x09;
    const ushort VK_BACK = 0x08;
    const ushort VK_SHIFT = 0x10;
    const ushort VK_HOME = 0x24;

    [StructLayout(LayoutKind.Sequential)]
    public struct MOUSEINPUT { public int dx, dy; public uint mouseData, dwFlags, time; public IntPtr dwExtraInfo; }
    [StructLayout(LayoutKind.Sequential)]
    public struct KEYBDINPUT { public ushort wVk, wScan; public uint dwFlags, time; public IntPtr dwExtraInfo; }
    [StructLayout(LayoutKind.Sequential)]
    public struct HARDWAREINPUT { public uint uMsg; public ushort wParamL, wParamH; }
    [StructLayout(LayoutKind.Explicit)]
    public struct INPUTUNION { [FieldOffset(0)] public MOUSEINPUT mi; [FieldOffset(0)] public KEYBDINPUT ki; [FieldOffset(0)] public HARDWAREINPUT hi; }
    [StructLayout(LayoutKind.Sequential)]
    public struct INPUT { public uint type; public INPUTUNION u; }

    static int inputSize = Marshal.SizeOf(typeof(INPUT));
    static Random rng = new Random();

    static bool IsKeyDown(int vk) { return (GetAsyncKeyState(vk) & 0x8000) != 0; }

    static void SendVK(ushort vk, bool down, bool extended = false)
    {
        INPUT[] inp = new INPUT[1];
        inp[0].type = 1;
        inp[0].u.ki.wVk = vk;
        uint flags = 0;
        if (extended) flags |= KEYEVENTF_EXTENDEDKEY;
        if (!down) flags |= KEYEVENTF_KEYUP;
        inp[0].u.ki.dwFlags = flags;
        SendInput(1, inp, inputSize);
    }

    static void TypeVKey(ushort vkey, bool extended = false)
    {
        SendVK(vkey, true, extended);
        Thread.Sleep(rng.Next(5, 12)); // Micro-delay to prevent dropped keys
        SendVK(vkey, false, extended);
    }

    static void SendUnicode(char c)
    {
        INPUT[] inp = new INPUT[1];
        
        // Key Down
        inp[0].type = 1;
        inp[0].u.ki.wVk = 0;
        inp[0].u.ki.wScan = (ushort)c;
        inp[0].u.ki.dwFlags = KEYEVENTF_UNICODE;
        SendInput(1, inp, inputSize);
        
        Thread.Sleep(rng.Next(5, 12)); // Micro-delay to simulate physical key press duration
        
        // Key Up
        inp[0].u.ki.dwFlags = KEYEVENTF_UNICODE | KEYEVENTF_KEYUP;
        SendInput(1, inp, inputSize);
    }

    static void SmartEnter()
    {
        TypeVKey(VK_RETURN);
        Thread.Sleep(20);
        
        SendUnicode('X');
        Thread.Sleep(10);
        
        // Select everything back to the start of the line
        SendVK(VK_SHIFT, true);
        TypeVKey(VK_HOME, true); // Extended
        TypeVKey(VK_HOME, true); // Extended
        SendVK(VK_SHIFT, false);
        Thread.Sleep(10);
        
        // Delete selection
        TypeVKey(VK_BACK);
        Thread.Sleep(10);
    }

    static void ReleaseModifiers()
    {
        SendVK(0x10, false); // VK_SHIFT
        SendVK(0x11, false); // VK_CONTROL
        SendVK(0x12, false); // VK_MENU (Alt)
    }

    static int CountCtrlTaps()
    {
        int taps = 0;
        if (IsKeyDown(0x11)) // VK_CONTROL
        {
            taps++;
            while (IsKeyDown(0x11)) Thread.Sleep(5);
            
            for (int i = 0; i < 40; i++)
            {
                if (IsKeyDown(0x11))
                {
                    taps++;
                    while (IsKeyDown(0x11)) Thread.Sleep(5);
                    
                    for (int j = 0; j < 40; j++)
                    {
                        if (IsKeyDown(0x11))
                        {
                            taps++;
                            while (IsKeyDown(0x11)) Thread.Sleep(5);
                            return taps;
                        }
                        Thread.Sleep(10);
                    }
                    return taps;
                }
                Thread.Sleep(10);
            }
        }
        return taps;
    }

    static int burstCounter = 0;

    static int GetHumanDelay(char c)
    {
        if (c == '\n') return rng.Next(300, 800); // Long think/breath after new line
        
        string symbols = ".,;{}()[]\"':\\/<>*&^%$#@!~`_+-=";
        if (symbols.Contains(c.ToString())) return rng.Next(150, 350); // Reaching for symbols

        if (c == ' ') return rng.Next(100, 200); // Word boundary pause

        if (burstCounter > 0)
        {
            burstCounter--;
            return rng.Next(40, 70); // Rapid but VISIBLE typing (not instant)
        }

        // 10% chance to start a fast typing burst
        if (rng.Next(1, 100) <= 10) 
        {
            burstCounter = rng.Next(3, 8);
            return rng.Next(40, 70);
        }

        // DRASTIC VARIANCE FOR NORMAL LETTERS
        int rand = rng.Next(1, 100);
        
        if (rand <= 15) // 15% chance: Finger travel / hesitation
        {
            return rng.Next(250, 450); 
        }
        else if (rand <= 40) // 25% chance: Slightly slower keystroke
        {
            return rng.Next(150, 250);
        }
        else // 60% chance: Normal deliberate typing
        {
            return rng.Next(80, 150);
        }
    }

    static char GetAdjacentTypo(char c)
    {
        string[] rows = { "qwertyuiop", "asdfghjkl", "zxcvbnm" };
        char lower = char.ToLower(c);
        
        foreach (string row in rows)
        {
            int idx = row.IndexOf(lower);
            if (idx != -1)
            {
                int shift = rng.Next(0, 2) == 0 ? 1 : -1;
                int newIdx = idx + shift;
                if (newIdx < 0) newIdx = 1;
                if (newIdx >= row.Length) newIdx = row.Length - 2;
                
                char typo = row[newIdx];
                return char.IsUpper(c) ? char.ToUpper(typo) : typo;
            }
        }
        return c;
    }

    static bool isIdeMode = true;

    public static void Run()
    {
        Console.WriteLine("========================================");
        Console.WriteLine("  Clipboard Typer - SMART MODE TOGGLE");
        Console.WriteLine("========================================");
        Console.WriteLine("  How to use:");
        Console.WriteLine("  1. Tap CTRL 3 times to switch modes.");
        Console.WriteLine("  2. Tap CTRL 2 times to start typing.");
        Console.WriteLine("========================================");
        Console.WriteLine("  Current Mode: [IDE MODE] (VS Code)");
        Console.WriteLine("========================================");

        while (true)
        {
            int taps = CountCtrlTaps();
            
            if (taps >= 3)
            {
                isIdeMode = !isIdeMode;
                try { Console.Beep(isIdeMode ? 1000 : 600, 300); } catch { }
                Console.WriteLine();
                Console.WriteLine(isIdeMode ? ">>> SWITCHED TO: [IDE MODE] (SmartEnter)" : ">>> SWITCHED TO: [TERMINAL MODE] (Pure Enter)");
            }
            else if (taps == 2)
            {
                string text = null;
                try { text = Clipboard.GetText(); } catch { }
                
                if (!string.IsNullOrEmpty(text))
                {
                    Console.WriteLine("[TYPING] " + text.Length + " chars...");
                    
                    ReleaseModifiers(); 

                    bool isLeadingSpace = true;

                    foreach (char c in text)
                    {
                        if (IsKeyDown(VK_ESCAPE)) 
                        { 
                            Console.WriteLine("[ABORTED]"); 
                            ReleaseModifiers();
                            break; 
                        }
                        
                        if (c == '\r') continue;
                        
                        if (c == '\n') 
                        {
                            if (isIdeMode) SmartEnter();
                            else { TypeVKey(VK_RETURN); Thread.Sleep(20); }
                            isLeadingSpace = true; // Reset for new line
                            Thread.Sleep(GetHumanDelay(c));
                            continue;
                        }

                        if ((c == ' ' || c == '\t') && isLeadingSpace)
                        {
                            // Instantly type leading whitespace to mimic IDE auto-indent / human Tab press
                            if (c == '\t') TypeVKey(VK_TAB);
                            else SendUnicode(c);
                            
                            Thread.Sleep(1); 
                            continue;
                        }

                        if (c != ' ' && c != '\t') 
                        {
                            isLeadingSpace = false;
                        }

                        if (c == '\t') 
                        {
                            TypeVKey(VK_TAB);
                        }
                        else 
                        {
                            // 6% chance of a realistic adjacent-key typo on alphabets
                            if (char.IsLetter(c) && rng.Next(1, 100) <= 6)
                            {
                                char typo = GetAdjacentTypo(c);
                                if (typo != c)
                                {
                                    SendUnicode(typo);
                                    Thread.Sleep(rng.Next(250, 450)); // Realize the mistake
                                    TypeVKey(VK_BACK); // Backspace
                                    Thread.Sleep(rng.Next(100, 200)); // Pause before typing correctly
                                }
                            }
                            SendUnicode(c);
                        }
                        
                        Thread.Sleep(GetHumanDelay(c));
                    }

                    ReleaseModifiers(); 
                    Console.WriteLine("[DONE]");
                }
            }
            Thread.Sleep(15);
        }
    }
}
"@

Add-Type -TypeDefinition $source -ReferencedAssemblies System.Windows.Forms
[ClipTyper]::Run()
