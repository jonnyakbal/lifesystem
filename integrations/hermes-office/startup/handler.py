def handle(event_type, context):
    if event_type == 'gateway:startup':
        from hermes_cli.lifecycle import invoke_hook
        invoke_hook('jonny_office_start')
