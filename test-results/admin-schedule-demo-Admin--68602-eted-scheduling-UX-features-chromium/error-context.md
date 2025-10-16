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
        - textbox "Username:" [active] [ref=e11]:
          - /placeholder: Type 'admin' here
      - generic [ref=e12]:
        - generic [ref=e13]: "Password:"
        - textbox "Password:" [ref=e14]:
          - /placeholder: Type password here
      - button "Login" [ref=e15] [cursor=pointer]
    - generic [ref=e16]:
      - strong [ref=e17]: "Demo Credentials:"
      - text: "Username:"
      - code [ref=e18]: admin
      - text: "Password:"
      - code [ref=e19]: StrongAdminPass123!
  - alert [ref=e20]
```