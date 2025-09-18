# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - generic [ref=e5]: 🌭
      - heading "Admin Login" [level=1] [ref=e6]
      - paragraph [ref=e7]: Hotdog Diaries
    - generic [ref=e8]:
      - generic [ref=e9]:
        - generic [ref=e10]: "Username:"
        - textbox "Username:" [ref=e11]: wronguserwrongpass
      - generic [ref=e12]:
        - generic [ref=e13]: "Password:"
        - textbox "Password:" [active] [ref=e14]
      - button "Login" [ref=e15] [cursor=pointer]
    - generic [ref=e16]:
      - strong [ref=e17]: "Demo Credentials:"
      - text: "Username:"
      - code [ref=e18]: admin
      - text: "Password:"
      - code [ref=e19]: StrongAdminPass123!
  - button "Open Next.js Dev Tools" [ref=e25] [cursor=pointer]:
    - img [ref=e26] [cursor=pointer]
  - alert [ref=e29]
```