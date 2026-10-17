# Idempotently wires Prayly's native iOS pieces into the Flutter Runner project:
# bundle/team settings, native sources, bundled wallpaper content, localized
# permission prompts and the PraylyWidget extension (Home + Lock Screen).
#
#   GEM_PATH=... ruby ios/scripts/configure_xcode_project.rb
#
# The resulting project.pbxproj is committed; CI never needs to run this.
require 'xcodeproj'

IOS_DIR = File.expand_path('..', __dir__)
PROJECT_PATH = File.join(IOS_DIR, 'Runner.xcodeproj')
TEAM = 'NN9Q2FQYGP'
APP_ID = 'com.jesuswallpaperbible.app'
WIDGET_ID = "#{APP_ID}.PraylyWidget"
LANGS = %w[en hi es pt fr de id fil].freeze

project = Xcodeproj::Project.open(PROJECT_PATH)
runner = project.targets.find { |t| t.name == 'Runner' } or abort('Runner target missing')
tests = project.targets.find { |t| t.name == 'RunnerTests' }

def file_ref(group, path, project)
  group.files.find { |f| f.path == path } || group.new_reference(path)
end

def group_named(parent, name, path = nil)
  parent.groups.find { |g| g.display_name == name } || parent.new_group(name, path)
end

def add_source(target, ref)
  target.source_build_phase.add_file_reference(ref, true)
end

def add_resource(target, ref)
  target.resources_build_phase.add_file_reference(ref, true)
end

# ── Runner settings ─────────────────────────────────────────────────────────
runner.build_configurations.each do |c|
  s = c.build_settings
  s['PRODUCT_BUNDLE_IDENTIFIER'] = APP_ID
  s['DEVELOPMENT_TEAM'] = TEAM
  s['CODE_SIGN_STYLE'] = 'Automatic'
  s['CODE_SIGN_ENTITLEMENTS'] = 'Runner/Runner.entitlements'
  s['IPHONEOS_DEPLOYMENT_TARGET'] = '15.0'
  s['TARGETED_DEVICE_FAMILY'] = '1,2'
  s['ENABLE_BITCODE'] = 'NO'
  s['SWIFT_VERSION'] = '5.0'
  s['INFOPLIST_FILE'] = 'Runner/Info.plist'
  s['ASSETCATALOG_COMPILER_APPICON_NAME'] = 'AppIcon'
end
if tests
  tests.build_configurations.each do |c|
    c.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = "#{APP_ID}.RunnerTests"
    c.build_settings['DEVELOPMENT_TEAM'] = TEAM
  end
end
project.build_configurations.each do |c|
  c.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.0'
end

runner_group = project.main_group.groups.find { |g| g.display_name == 'Runner' } or abort('Runner group missing')

# Native sources.
prayly_group = group_named(runner_group, 'Prayly', 'Prayly')
%w[PraylyIosPlugin.swift PraylyNotifications.swift PraylyWallpaperRenderer.swift PraylyWallpaperIntent.swift].each do |name|
  add_source(runner, file_ref(prayly_group, name, project))
end

# Shared (app + widget).
shared_group = group_named(project.main_group, 'Shared', 'Shared')
shared_ref = file_ref(shared_group, 'PraylyShared.swift', project)
add_source(runner, shared_ref)

# Resources.
file_ref(runner_group, 'Runner.entitlements', project)
add_resource(runner, file_ref(runner_group, 'PrivacyInfo.xcprivacy', project))
content_ref = runner_group.files.find { |f| f.path == 'DailyWallpaper' }
unless content_ref
  content_ref = runner_group.new_reference('DailyWallpaper')
  content_ref.last_known_file_type = 'folder'
end
add_resource(runner, content_ref)

# Localized permission prompts (InfoPlist.strings).
variant = runner_group.children.find { |c| c.isa == 'PBXVariantGroup' && c.name == 'InfoPlist.strings' }
unless variant
  variant = project.new(Xcodeproj::Project::Object::PBXVariantGroup)
  variant.name = 'InfoPlist.strings'
  variant.source_tree = '<group>'
  runner_group.children << variant
end
LANGS.each do |lang|
  path = "#{lang}.lproj/InfoPlist.strings"
  next if variant.files.any? { |f| f.path == path }
  ref = project.new(Xcodeproj::Project::Object::PBXFileReference)
  ref.name = lang
  ref.path = path
  ref.source_tree = '<group>'
  ref.last_known_file_type = 'text.plist.strings'
  variant.children << ref
end
add_resource(runner, variant)
regions = project.root_object.known_regions
(LANGS + ['Base']).each { |l| regions << l unless regions.include?(l) }
project.root_object.development_region = 'en'

# ── PraylyWidget extension ──────────────────────────────────────────────────
widget = project.targets.find { |t| t.name == 'PraylyWidget' }
widget_group = group_named(project.main_group, 'PraylyWidget', 'PraylyWidget')
xcconfig_ref = file_ref(widget_group, 'PraylyWidget.xcconfig', project)
unless widget
  widget = project.new_target(:app_extension, 'PraylyWidget', :ios, '16.0', project.products_group, :swift)
end

# Profile configuration (Flutter projects build Debug / Profile / Release).
unless widget.build_configuration_list.build_configurations.any? { |c| c.name == 'Profile' }
  release = widget.build_configuration_list['Release']
  profile = project.new(Xcodeproj::Project::Object::XCBuildConfiguration)
  profile.name = 'Profile'
  profile.build_settings = release.build_settings.dup
  widget.build_configuration_list.build_configurations << profile
end

widget.build_configurations.each do |c|
  c.base_configuration_reference = xcconfig_ref
  s = c.build_settings
  s['PRODUCT_BUNDLE_IDENTIFIER'] = WIDGET_ID
  s['PRODUCT_NAME'] = '$(TARGET_NAME)'
  s['INFOPLIST_FILE'] = 'PraylyWidget/Info.plist'
  s['GENERATE_INFOPLIST_FILE'] = 'NO'
  s['CODE_SIGN_ENTITLEMENTS'] = 'PraylyWidget/PraylyWidget.entitlements'
  s['CODE_SIGN_STYLE'] = 'Automatic'
  s['DEVELOPMENT_TEAM'] = TEAM
  s['IPHONEOS_DEPLOYMENT_TARGET'] = '16.0'
  s['TARGETED_DEVICE_FAMILY'] = '1,2'
  s['SWIFT_VERSION'] = '5.0'
  s['SKIP_INSTALL'] = 'YES'
  s['APPLICATION_EXTENSION_API_ONLY'] = 'YES'
  s['ENABLE_BITCODE'] = 'NO'
  s['LD_RUNPATH_SEARCH_PATHS'] = ['$(inherited)', '@executable_path/Frameworks', '@executable_path/../../Frameworks']
  s['SWIFT_EMIT_LOC_STRINGS'] = 'YES'
  s['CURRENT_PROJECT_VERSION'] = '$(FLUTTER_BUILD_NUMBER)'
  s['MARKETING_VERSION'] = '$(FLUTTER_BUILD_NAME)'
  s['SWIFT_OPTIMIZATION_LEVEL'] = c.name == 'Debug' ? '-Onone' : '-O'
  s.delete('ASSETCATALOG_COMPILER_APPICON_NAME')
  s.delete('ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME')
  s.delete('ASSETCATALOG_COMPILER_WIDGET_BACKGROUND_COLOR_NAME')
end

add_source(widget, file_ref(widget_group, 'PraylyWidget.swift', project))
add_source(widget, shared_ref)
file_ref(widget_group, 'Info.plist', project)
file_ref(widget_group, 'PraylyWidget.entitlements', project)
add_resource(widget, file_ref(widget_group, 'PrivacyInfo.xcprivacy', project))
widget_content = widget_group.files.find { |f| f.path == 'WidgetContent' }
unless widget_content
  widget_content = widget_group.new_reference('WidgetContent')
  widget_content.last_known_file_type = 'folder'
end
add_resource(widget, widget_content)
%w[WidgetKit SwiftUI].each do |fw|
  unless widget.frameworks_build_phase.files.any? { |f| f.display_name == "#{fw}.framework" }
    widget.add_system_framework(fw)
  end
end

# Runner embeds + depends on the widget.
runner.add_dependency(widget) unless runner.dependencies.any? { |d| d.target == widget }
embed = runner.copy_files_build_phases.find { |p| p.name == 'Embed Foundation Extensions' }
unless embed
  embed = project.new(Xcodeproj::Project::Object::PBXCopyFilesBuildPhase)
  embed.name = 'Embed Foundation Extensions'
  embed.symbol_dst_subfolder_spec = :plug_ins
  embed.dst_path = ''
  # Must run before Flutter's "Thin Binary" script, or Xcode reports a cycle.
  frameworks_idx = runner.build_phases.index { |p| p.respond_to?(:name) && p.name == 'Embed Frameworks' }
  insert_at = frameworks_idx ? frameworks_idx + 1 : runner.build_phases.index(runner.resources_build_phase) + 1
  runner.build_phases.insert(insert_at, embed)
end
unless embed.files.any? { |f| f.file_ref == widget.product_reference }
  bf = embed.add_file_reference(widget.product_reference, true)
  bf.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }
end

# Target attributes (automatic signing for both targets).
attrs = project.root_object.attributes['TargetAttributes'] ||= {}
[runner, widget].each do |t|
  attrs[t.uuid] ||= {}
  attrs[t.uuid]['DevelopmentTeam'] = TEAM
  attrs[t.uuid]['ProvisioningStyle'] = 'Automatic'
end
attrs[widget.uuid]['CreatedOnToolsVersion'] = '16.0'

project.save
puts "Configured: #{project.targets.map(&:name).join(', ')}"
puts "Runner phases: #{runner.build_phases.map(&:display_name).join(' → ')}"
