import re

# 1. documents.routes.ts
with open('src/server/modules/documents/documents.routes.ts', 'r', encoding='utf-8') as f:
    text = f.read()

if 'subscriptionEnforcementMiddleware' not in text:
    text = text.replace(
        'import{authMiddleware}from"../../middleware/auth.middleware.js";',
        'import{authMiddleware}from"../../middleware/auth.middleware.js";import{subscriptionEnforcementMiddleware}from"../../middleware/subscription.middleware.js";'
    )
    text = text.replace(
        'documentsRouter.use(authMiddleware);',
        'documentsRouter.use(authMiddleware);documentsRouter.use(subscriptionEnforcementMiddleware);'
    )
    with open('src/server/modules/documents/documents.routes.ts', 'w', encoding='utf-8') as f:
        f.write(text)
    print('Patched documents.routes.ts')

# 2. owners.routes.ts
with open('src/server/modules/owners/owners.routes.ts', 'r', encoding='utf-8') as f:
    text = f.read()

if 'subscriptionEnforcementMiddleware' not in text:
    text = text.replace(
        'import{authMiddleware}from"../../middleware/auth.middleware.js";',
        'import{authMiddleware}from"../../middleware/auth.middleware.js";import{subscriptionEnforcementMiddleware}from"../../middleware/subscription.middleware.js";'
    )
    text = text.replace(
        'ownersRouter.use(authMiddleware);',
        'ownersRouter.use(authMiddleware);ownersRouter.use(subscriptionEnforcementMiddleware);'
    )
    with open('src/server/modules/owners/owners.routes.ts', 'w', encoding='utf-8') as f:
        f.write(text)
    print('Patched owners.routes.ts')

# 3. agent.routes.ts and search.routes.ts
for mod in ['agent', 'search']:
    p = f'src/server/modules/{mod}/{mod}.routes.ts'
    with open(p, 'r', encoding='utf-8') as f:
        t = f.read()
    if 'subscriptionEnforcementMiddleware' not in t:
        t = t.replace(
            'import{authMiddleware}from"../../middleware/auth.middleware.js";',
            'import{authMiddleware}from"../../middleware/auth.middleware.js";import{subscriptionEnforcementMiddleware}from"../../middleware/subscription.middleware.js";'
        )
        t = t.replace(
            f'{mod}Router.use(authMiddleware);',
            f'{mod}Router.use(authMiddleware);{mod}Router.use(subscriptionEnforcementMiddleware);'
        )
        with open(p, 'w', encoding='utf-8') as f:
            f.write(t)
        print(f'Patched {mod}.routes.ts')

print('All routes patched with subscription enforcement successfully!')
