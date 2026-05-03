import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../../providers/app_provider.dart';
import '../../config/theme.dart';
import '../../models/project.dart';

class ProjectsScreen extends StatelessWidget {
  const ProjectsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<AppColors>()!;
    final prov = context.watch<ProjectProvider>();

    return SafeArea(
      child: RefreshIndicator(
        onRefresh: () => prov.loadProjects(),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 100),
          children: [
            Row(
              children: [
                Text('Projekty', style: Theme.of(context).textTheme.headlineSmall),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(color: colors.secondary.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
                  child: Text('${prov.projects.length}', style: TextStyle(color: colors.secondary, fontWeight: FontWeight.w700, fontSize: 13)),
                ),
              ],
            ),
            const SizedBox(height: 16),
            if (prov.loading)
              const Center(child: CircularProgressIndicator())
            else if (prov.error != null)
              Center(child: Padding(padding: const EdgeInsets.all(32), child: Text('Błąd: ${prov.error}', style: TextStyle(color: Theme.of(context).extension<AppColors>()!.error, fontSize: 14), textAlign: TextAlign.center)))
            else if (prov.projects.isEmpty)
              Center(
                child: Column(
                  children: [
                    const SizedBox(height: 80),
                    Icon(Icons.folder_off, size: 48, color: const Color(0xFFB2BEC3).withOpacity(0.5)),
                    const SizedBox(height: 12),
                    Text('Brak projektów', style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: const Color(0xFFB2BEC3))),
                  ],
                ),
              )
            else
              ...prov.projects.asMap().entries.map((e) => _ProjectCard(project: e.value, index: e.key)),
          ],
        ),
      ),
    );
  }
}

class _ProjectCard extends StatelessWidget {
  final Project project;
  final int index;

  const _ProjectCard({required this.project, required this.index});

  Color _statusColor(AppColors c) {
    switch (project.status) {
      case 'accepted': return c.success;
      case 'cancelled': return c.error;
      case 'to_final_estimation':
      case 'to_prepare_final_offer': return c.warning;
      default: return c.primary;
    }
  }

  String _statusLabel() {
    switch (project.status) {
      case 'active': return 'Aktywny';
      case 'accepted': return 'Zaakceptowany';
      case 'cancelled': return 'Anulowany';
      case 'to_final_estimation': return 'Do wyceny';
      case 'to_prepare_final_offer': return 'Do oferty';
      default: return project.status;
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<AppColors>()!;
    final sc = _statusColor(colors);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFF1F2F6)),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: () {
            Navigator.push(context, MaterialPageRoute(builder: (_) => ProjectDetailScreen(project: project)));
          },
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 46, height: 46,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(colors: [colors.secondary.withOpacity(0.3), colors.secondary.withOpacity(0.1)]),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Icon(Icons.folder_rounded, color: colors.secondary, size: 24),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(project.name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16, color: Color(0xFF2D3436)), maxLines: 1, overflow: TextOverflow.ellipsis),
                          const SizedBox(height: 2),
                          Text(project.clientName, style: const TextStyle(fontSize: 13, color: Color(0xFF636E72))),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(color: sc.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
                      child: Text(_statusLabel(), style: TextStyle(color: sc, fontSize: 11, fontWeight: FontWeight.w600)),
                    ),
                  ],
                ),
                if (project.pricing != null) ...[
                  const SizedBox(height: 14),
                  const Divider(height: 1, color: Color(0xFFF1F2F6)),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      const Icon(Icons.payments_outlined, size: 16, color: Color(0xFFB2BEC3)),
                      const SizedBox(width: 6),
                      Text('${NumberFormat('#,##0', 'pl').format(project.pricing!.total)} PLN', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: Color(0xFF2D3436))),
                      const Spacer(),
                      if (project.owner != null) ...[
                        Container(
                          width: 28, height: 28,
                          decoration: BoxDecoration(gradient: LinearGradient(colors: [colors.primary.withOpacity(0.6), colors.primary]), shape: BoxShape.circle),
                          child: Center(
                            child: Text(
                              '${project.owner!.firstName.isNotEmpty ? project.owner!.firstName[0] : ''}${project.owner!.lastName.isNotEmpty ? project.owner!.lastName[0] : ''}',
                              style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700),
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class ProjectDetailScreen extends StatelessWidget {
  final Project project;
  const ProjectDetailScreen({super.key, required this.project});

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<AppColors>()!;

    return Scaffold(
      appBar: AppBar(title: Text(project.name)),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: LinearGradient(colors: [colors.secondary.withOpacity(0.1), colors.secondary.withOpacity(0.03)]),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: colors.secondary.withOpacity(0.15)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Klient', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: colors.secondary)),
                const SizedBox(height: 4),
                Text(project.clientName, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Color(0xFF2D3436))),
                if (project.clientEmail != null) ...[
                  const SizedBox(height: 4),
                  Text(project.clientEmail!, style: const TextStyle(fontSize: 13, color: Color(0xFF636E72))),
                ],
              ],
            ),
          ),
          const SizedBox(height: 20),
          if (project.description != null && project.description!.isNotEmpty) ...[
            Text('Opis', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            Text(project.description!, style: const TextStyle(fontSize: 14, color: Color(0xFF636E72), height: 1.5)),
            const SizedBox(height: 20),
          ],
          if (project.pricing != null) ...[
            Text('Wycena', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            _PriceRow(label: 'Faza 1', value: project.pricing!.phase1),
            _PriceRow(label: 'Faza 2', value: project.pricing!.phase2),
            _PriceRow(label: 'Faza 3', value: project.pricing!.phase3),
            _PriceRow(label: 'Faza 4', value: project.pricing!.phase4),
            const Divider(height: 24),
            _PriceRow(label: 'Razem', value: project.pricing!.total, bold: true),
          ],
        ],
      ),
    );
  }
}

class _PriceRow extends StatelessWidget {
  final String label;
  final double value;
  final bool bold;
  const _PriceRow({required this.label, required this.value, this.bold = false});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(fontSize: 14, color: const Color(0xFF636E72), fontWeight: bold ? FontWeight.w700 : FontWeight.w400)),
          Text('${NumberFormat('#,##0', 'pl').format(value)} PLN',
              style: TextStyle(fontSize: 14, color: const Color(0xFF2D3436), fontWeight: bold ? FontWeight.w700 : FontWeight.w500)),
        ],
      ),
    );
  }
}
